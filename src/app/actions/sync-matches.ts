
'use client';

import { doc, setDoc, collection, Firestore, getDocs, writeBatch, getDoc } from 'firebase/firestore';
import { fetchLiveMatches, fetchDailySchedule } from '@/services/cricket-api-service';

/**
 * Synchronizes live and upcoming matches from Sportradar API to Firestore.
 * Implements a 10-second lock to prevent redundant API calls from multiple users.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    const settingsRef = doc(db, 'app_settings', 'global');
    const settingsSnap = await getDoc(settingsRef);
    
    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      
      // 1. Check if a global clear is in progress
      if (data.syncStatus === 'clearing') {
        console.log("[Sync] Skipping sync: Database is currently being cleared.");
        return { success: false, reason: 'clearing' };
      }

      // 2. Concurrency Protection: Only sync if the last sync was more than 10 seconds ago
      const lastSync = data.lastGlobalSync ? new Date(data.lastGlobalSync).getTime() : 0;
      const now = Date.now();
      if (now - lastSync < 10000) {
        return { success: true, reason: 'recent_sync_exists' };
      }
    }

    console.log("[Sync] Network Sync Triggered: Fetching fresh data from Sportradar...");
    
    // Fetch live matches
    const liveMatches = await fetchLiveMatches();
    
    // Fetch 3-day schedule to catch tomorrow's games (e.g. Semi-Finals)
    const dates = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }

    const schedulePromises = dates.map(date => fetchDailySchedule(date));
    const scheduleResults = await Promise.all(schedulePromises);
    
    // Combine all results and deduplicate by ID
    const combined = [...liveMatches, ...scheduleResults.flat()];
    const matchMap = new Map();
    combined.forEach(m => matchMap.set(m.id, m));
    
    const externalMatches = Array.from(matchMap.values());

    if (!externalMatches || externalMatches.length === 0) {
      console.log("[Sync] No matches found in API feed.");
      await updateSyncStatus(db, 'success', 0, 0);
      return { success: true, count: 0 };
    }

    // Filter out placeholders and Team A/B generic names strictly
    const validMatches = externalMatches.filter(m => 
      m.teams && 
      !m.teams.some(t => 
        t.toLowerCase().includes('team a') || 
        t.toLowerCase().includes('team b') || 
        t.toLowerCase() === 'tba'
      )
    );

    const batch = writeBatch(db);
    let updatedCount = 0;

    for (const match of validMatches) {
      const matchRef = doc(db, 'matches', match.id);
      
      const probHome = match.probabilities?.home || 50;
      const probAway = match.probabilities?.away || 50;

      // Professional back/lay spreads (Back: (1/Prob)*0.98, Lay: (1/Prob)*1.02)
      const homeBack = Math.max(1.01, (100 / probHome) * 0.98);
      const homeLay = Math.max(1.02, (100 / probHome) * 1.02);
      const awayBack = Math.max(1.01, (100 / probAway) * 0.98);
      const awayLay = Math.max(1.02, (100 / probAway) * 1.02);

      // Construct accurate score string from the refined parser
      const scoreStr = match.score 
        ? match.score.map(s => `${s.r}`).join(' | ') 
        : 'TBD';

      const matchData = {
        teamA: match.teams[0] || 'TBA',
        teamB: match.teams[1] || 'TBA',
        startTime: match.date,
        status: match.status,
        statusText: match.rawStatusText || 'Live',
        currentScore: scoreStr,
        venue: match.venue,
        series: match.series || 'International Series',
        lastUpdated: new Date().toISOString(),
        odds: {
          home: { back: homeBack, lay: homeLay },
          away: { back: awayBack, lay: awayLay }
        }
      };

      batch.set(matchRef, matchData, { merge: true });
      updatedCount++;

      // Update the market subcollection
      const marketRef = doc(collection(db, 'matches', match.id, 'markets'), 'match_winner');
      batch.set(marketRef, {
        id: 'match_winner',
        type: 'match_winner',
        status: match.status === 'finished' ? 'closed' : 'open',
        selections: [
          { id: 'home', name: matchData.teamA, odds: homeBack, layOdds: homeLay },
          { id: 'away', name: matchData.teamB, odds: awayBack, layOdds: awayLay }
        ]
      }, { merge: true });
    }

    await batch.commit();
    await updateSyncStatus(db, 'success', updatedCount, 0);

    return { success: true, count: updatedCount };
  } catch (error: any) {
    console.error("Critical Sync Error:", error);
    await updateSyncStatus(db, 'error', 0, 0, error.message);
    return { error: error.message };
  }
}

async function updateSyncStatus(db: Firestore, status: 'success' | 'error' | 'clearing' | 'idle', count: number, deleted: number, errorMsg?: string) {
  const settingsRef = doc(db, 'app_settings', 'global');
  await setDoc(settingsRef, { 
    lastGlobalSync: new Date().toISOString(),
    activeMatchesCount: count,
    syncStatus: status,
    syncError: errorMsg || null,
  }, { merge: true });
}

/**
 * Clears all match data from Firestore.
 */
export async function clearAllMatchesAction(db: Firestore) {
  try {
    const settingsRef = doc(db, 'app_settings', 'global');
    await setDoc(settingsRef, { 
      syncStatus: 'clearing',
    }, { merge: true });

    const matchesRef = collection(db, 'matches');
    const snapshot = await getDocs(matchesRef);
    
    if (snapshot.empty) {
        await setDoc(settingsRef, { syncStatus: 'idle', activeMatchesCount: 0 }, { merge: true });
        return { success: true, count: 0 };
    }
    
    // Batch delete matches and their subcollections
    for (const docSnap of snapshot.docs) {
      const marketsRef = collection(db, 'matches', docSnap.id, 'markets');
      const marketsSnap = await getDocs(marketsRef);
      const subBatch = writeBatch(db);
      marketsSnap.docs.forEach(m => subBatch.delete(m.ref));
      subBatch.delete(docSnap.ref);
      await subBatch.commit();
    }
    
    await setDoc(settingsRef, { 
      activeMatchesCount: 0,
      syncStatus: 'idle'
    }, { merge: true });

    return { success: true, count: snapshot.size };
  } catch (error: any) {
    console.error("Clear Terminal Error:", error);
    return { error: error.message };
  }
}
