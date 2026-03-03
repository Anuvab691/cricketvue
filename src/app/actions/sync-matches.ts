
'use client';

import { doc, setDoc, collection, Firestore, getDocs, writeBatch, getDoc } from 'firebase/firestore';
import { fetchLiveMatches, fetchDailySchedule, fetchCompetitions } from '@/services/cricket-api-service';

/**
 * Synchronizes live/upcoming matches AND tournaments from Sportradar to Firestore.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    const settingsRef = doc(db, 'app_settings', 'global');
    const settingsSnap = await getDoc(settingsRef);
    
    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      if (data.syncStatus === 'clearing') return { success: false, reason: 'clearing' };
      const lastSync = data.lastGlobalSync ? new Date(data.lastGlobalSync).getTime() : 0;
      if (Date.now() - lastSync < 10000) return { success: true, reason: 'recent' };
    }

    console.log("[Sync] Pulse: Fetching professional data...");
    
    const dates = [0, 1, 2].map(i => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    });

    const [liveMatches, competitions, ...scheduleResults] = await Promise.all([
      fetchLiveMatches(),
      fetchCompetitions(),
      ...dates.map(date => fetchDailySchedule(date))
    ]);
    
    // Sync Tournaments
    const tournamentBatch = writeBatch(db);
    const majorTournaments = (competitions || []).filter(c => 
      c.name.toLowerCase().includes('icc') || 
      c.name.toLowerCase().includes('t20') || 
      c.name.toLowerCase().includes('ipl') ||
      c.name.toLowerCase().includes('big bash') ||
      c.name.toLowerCase().includes('asia cup')
    );

    majorTournaments.forEach(t => {
      const tRef = doc(db, 'tournaments', t.id);
      tournamentBatch.set(tRef, { ...t, lastUpdated: new Date().toISOString() }, { merge: true });
    });
    await tournamentBatch.commit();

    // Sync Matches
    const combined = [...(liveMatches || []), ...scheduleResults.flat().filter(Boolean)];
    const matchMap = new Map();
    combined.forEach(m => { if (m?.id) matchMap.set(m.id, m); });
    
    const validMatches = Array.from(matchMap.values()).filter(m => 
      m.teams && !m.teams.some(t => t.toLowerCase().includes('team a') || t.toLowerCase().includes('team b'))
    );

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

    return { success: true, count: updatedCount };
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
        const subCol = col === 'matches' ? 'markets' : 'markets';
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
