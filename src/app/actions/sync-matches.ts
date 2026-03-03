
'use client';

import { doc, setDoc, collection, Firestore, getDocs, writeBatch, getDoc } from 'firebase/firestore';
import { fetchLiveMatches, fetchDailySchedule, fetchCompetitions } from '@/services/cricket-api-service';

/**
 * Synchronizes live/upcoming matches AND tournaments from Sportradar to Firestore.
 * Updated to handle Trial API rate limits (1 req/sec).
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    const settingsRef = doc(db, 'app_settings', 'global');
    const settingsSnap = await getDoc(settingsRef);
    
    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      if (data.syncStatus === 'clearing') return { success: false, reason: 'clearing' };
      const lastSync = data.lastGlobalSync ? new Date(data.lastGlobalSync).getTime() : 0;
      // High-frequency sync limit: 10 seconds
      if (Date.now() - lastSync < 10000) return { success: true, reason: 'recent' };
    }

    console.log("[Sync] Pulse: Fetching professional data (Sequential for Trial API)...");
    
    // Dates for the next 3 days
    const dates = [0, 1, 2].map(i => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    });

    // Sequential fetching to respect Trial API rate limits (1 request per second)
    const liveMatches = await fetchLiveMatches();
    await new Promise(r => setTimeout(r, 1100)); // 1.1s delay
    
    const competitions = await fetchCompetitions();
    await new Promise(r => setTimeout(r, 1100));

    const scheduleResults = [];
    for (const date of dates) {
      const daily = await fetchDailySchedule(date);
      if (daily) scheduleResults.push(daily);
      await new Promise(r => setTimeout(r, 1100));
    }

    const combinedMatches = [...(liveMatches || []), ...scheduleResults.flat().filter(Boolean)];
    
    if (combinedMatches.length === 0) {
      console.warn("[Sync] No matches returned from API. Check API Key and Trial restrictions.");
    }

    // 1. Sync Tournaments
    const tournamentBatch = writeBatch(db);
    const tournamentMap = new Map();

    // Seed with master competitions list
    (competitions || []).forEach(c => {
      tournamentMap.set(c.id, {
        id: c.id,
        name: c.name,
        category: c.category || 'International',
        gender: c.gender || 'men',
        type: c.type || 'league'
      });
    });

    // Aggressively extract tournaments from live/scheduled matches
    combinedMatches.forEach(m => {
      if (m.seriesId && m.series && !tournamentMap.has(m.seriesId)) {
        tournamentMap.set(m.seriesId, {
          id: m.seriesId,
          name: m.series,
          category: 'Active Feed Series',
          gender: 'men',
          type: 'league'
        });
      }
    });

    const filteredTournaments = Array.from(tournamentMap.values());

    filteredTournaments.forEach(t => {
      const tRef = doc(db, 'tournaments', t.id);
      tournamentBatch.set(tRef, { ...t, lastUpdated: new Date().toISOString() }, { merge: true });
    });
    await tournamentBatch.commit();

    // 2. Sync Matches
    const matchMap = new Map();
    combinedMatches.forEach(m => { if (m?.id) matchMap.set(m.id, m); });
    
    // For Trial Keys, we allow "Team A" and "Team B" since they are often placeholders for testing
    const validMatches = Array.from(matchMap.values());

    const batch = writeBatch(db);
    let updatedCount = 0;

    for (const match of validMatches) {
      const matchRef = doc(db, 'matches', match.id);
      const probHome = match.probabilities?.home || 50;
      const probAway = match.probabilities?.away || 50;

      const matchData: any = {
        teamA: match.teams[0] || 'TBA',
        teamB: match.teams[1] || 'TBA',
        startTime: match.date,
        status: match.status,
        statusText: match.rawStatusText || 'Live',
        venue: match.venue,
        series: match.series || 'International Series',
        seriesId: match.seriesId || '',
        lastUpdated: new Date().toISOString(),
        odds: {
          home: { back: Math.max(1.01, (100 / probHome) * 0.98), lay: Math.max(1.02, (100 / probHome) * 1.02) },
          away: { back: Math.max(1.01, (100 / probAway) * 0.98), lay: Math.max(1.02, (100 / probAway) * 1.02) }
        }
      };

      let scoreStr = 'TBD';
      if (match.score) scoreStr = match.score.map(s => `${s.r}`).join(' | ');
      if (scoreStr !== 'TBD' || match.status === 'upcoming') matchData.currentScore = scoreStr;

      batch.set(matchRef, matchData, { merge: true });
      updatedCount++;

      // Initialize/Update the match winner market
      const marketRef = doc(collection(db, 'matches', match.id, 'markets'), 'match_winner');
      batch.set(marketRef, {
        id: 'match_winner',
        type: 'match_winner',
        status: match.status === 'finished' ? 'closed' : 'open',
        selections: [
          { id: 'home', name: matchData.teamA, odds: matchData.odds.home.back, layOdds: matchData.odds.home.lay },
          { id: 'away', name: matchData.teamB, odds: matchData.odds.away.back, layOdds: matchData.odds.away.lay }
        ]
      }, { merge: true });
    }

    await batch.commit();
    await setDoc(settingsRef, { 
      lastGlobalSync: new Date().toISOString(),
      activeMatchesCount: updatedCount,
      syncStatus: 'success'
    }, { merge: true });

    return { success: true, count: updatedCount, tournamentsCount: filteredTournaments.length };
  } catch (error: any) {
    console.error("Sync Error:", error);
    return { success: false, error: error.message };
  }
}

export async function clearAllMatchesAction(db: Firestore) {
  try {
    const settingsRef = doc(db, 'app_settings', 'global');
    await setDoc(settingsRef, { syncStatus: 'clearing' }, { merge: true });

    const collections = ['matches', 'tournaments'];
    for (const col of collections) {
      const snap = await getDocs(collection(db, col));
      for (const docSnap of snap.docs) {
        // Clear subcollections
        const subCol = 'markets';
        const subSnap = await getDocs(collection(db, col, docSnap.id, subCol));
        const b = writeBatch(db);
        subSnap.docs.forEach(d => b.delete(d.ref));
        b.delete(docSnap.ref);
        await b.commit();
      }
    }
    
    await setDoc(settingsRef, { syncStatus: 'idle', activeMatchesCount: 0, lastGlobalSync: null }, { merge: true });
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
