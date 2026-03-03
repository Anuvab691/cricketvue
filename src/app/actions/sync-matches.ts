
'use client';

import { doc, setDoc, collection, Firestore, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { fetchLiveMatches, fetchDailySchedule, ExternalMatch } from '@/services/cricket-api-service';

/**
 * Syncs actual real-world cricket data from Sportradar into our Firestore matches collection.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    const datesToSync = [0, 1, 2].map(offset => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return d.toISOString().split('T')[0];
    });

    // Attempt to fetch data
    const results = await Promise.allSettled([
      fetchLiveMatches(),
      ...datesToSync.map(date => fetchDailySchedule(date))
    ]);

    const allResponses = results.map(r => r.status === 'fulfilled' ? r.value : []);
    const [liveMatches, ...schedules] = allResponses;

    const matchMap = new Map<string, ExternalMatch>();
    schedules.flat().forEach(m => matchMap.set(m.id, m));
    liveMatches.forEach(m => matchMap.set(m.id, m));
    
    const allMatches = Array.from(matchMap.values());

    // Filter out placeholders or trial-limited generic names
    const validMatches = allMatches.filter(m => {
      const t1 = (m.teams[0] || '').toLowerCase().trim();
      const t2 = (m.teams[1] || '').toLowerCase().trim();
      
      const isGeneric = 
        t1.includes('team a') || t1.includes('team b') || 
        t2.includes('team a') || t2.includes('team b') ||
        t1 === 'tba' || t2 === 'tba' ||
        t1 === 'placeholder' || t1 === 'to be announced';
        
      return !isGeneric;
    });

    const apiMatchIds = new Set(validMatches.map(m => m.id.replace(/:/g, '_')));

    // CLEANUP: Always check for existing matches that are no longer in the active Sportradar feed
    const matchesRef = collection(db, 'matches');
    const existingSnap = await getDocs(matchesRef);
    const deleteBatch = writeBatch(db);
    let deletedCount = 0;

    existingSnap.forEach((docSnap) => {
      const data = docSnap.data();
      // Only purge if it's from the Sportradar source and NOT in the current valid feed
      if (data.source === 'Sportradar' && !apiMatchIds.has(docSnap.id)) {
        deleteBatch.delete(docSnap.ref);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      await deleteBatch.commit();
    }
    
    // If no real matches are found in the feed (or API is disconnected), we report success with 0 count
    if (validMatches.length === 0) {
      await updateSyncStatus(db, 'success', 0, deletedCount);
      return { success: true, count: 0, deleted: deletedCount };
    }

    // UPDATE/CREATE
    for (const m of validMatches) {
      const safeId = m.id.replace(/:/g, '_');
      const matchRef = doc(db, 'matches', safeId);
      
      let status: 'live' | 'upcoming' | 'finished' = 'upcoming';
      if (m.matchEnded) status = 'finished';
      else if (m.matchStarted) status = 'live';

      const scoreString = m.score 
        ? m.score.map(s => `${s.inning}: ${s.r}`).join(' | ')
        : (status === 'live' ? 'In Progress' : 'Scheduled');

      await setDoc(matchRef, {
        teamA: m.teams[0],
        teamB: m.teams[1],
        startTime: m.date,
        series: m.series,
        matchType: m.matchType,
        status: status,
        statusText: m.rawStatusText || status,
        currentScore: scoreString,
        venue: m.venue,
        source: 'Sportradar',
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      // Init basic market
      const marketsRef = collection(db, 'matches', safeId, 'markets');
      const winnerMarketRef = doc(marketsRef, 'match_winner');
      await setDoc(winnerMarketRef, {
        type: 'match_winner',
        status: 'open',
        selections: [
          { id: 'sel_a', name: m.teams[0], odds: 1.90 },
          { id: 'sel_b', name: m.teams[1], odds: 1.90 }
        ]
      }, { merge: true });
    }

    await updateSyncStatus(db, 'success', validMatches.length, deletedCount);
    return { success: true, count: validMatches.length, deleted: deletedCount };
  } catch (error: any) {
    console.error("Sync Internal Failure:", error);
    await updateSyncStatus(db, 'error', 0, 0, error.message);
    return { error: error.message };
  }
}

async function updateSyncStatus(db: Firestore, status: 'success' | 'error', count: number, deleted: number, errorMsg?: string) {
  const settingsRef = doc(db, 'app_settings', 'global');
  await setDoc(settingsRef, { 
    lastGlobalSync: new Date().toISOString(),
    activeMatchesCount: count,
    syncStatus: status,
    syncError: errorMsg || null,
    matchesDeletedInLastSync: deleted
  }, { merge: true });
}

export async function clearAllMatchesAction(db: Firestore) {
  try {
    const matchesRef = collection(db, 'matches');
    const snapshot = await getDocs(matchesRef);
    if (snapshot.empty) return { success: true, count: 0 };
    
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    
    return { success: true, count: snapshot.size };
  } catch (error: any) {
    return { error: error.message };
  }
}
