'use client';

import { doc, setDoc, collection, Firestore, getDocs, writeBatch, getDoc } from 'firebase/firestore';
import { fetchLiveMatches, fetchDailySchedule, ExternalMatch } from '@/services/cricket-api-service';

/**
 * Syncs actual real-world cricket data from Sportradar into our Firestore matches collection.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    // 1. Check if we are currently in a "clearing" state
    const settingsRef = doc(db, 'app_settings', 'global');
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists() && settingsSnap.data().syncStatus === 'clearing') {
      console.log("[Sync] Clearing in progress, skipping auto-sync.");
      return { success: false, reason: 'clearing' };
    }

    const datesToSync = [0, 1, 2].map(offset => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return d.toISOString().split('T')[0];
    });

    // 2. Fetch from Server Action
    const results = await Promise.allSettled([
      fetchLiveMatches(),
      ...datesToSync.map(date => fetchDailySchedule(date))
    ]);

    const allResponses = results.map(r => r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : []);
    const [liveMatches, ...schedules] = allResponses;

    const matchMap = new Map<string, ExternalMatch>();
    schedules.flat().forEach(m => { if(m && m.id) matchMap.set(m.id, m) });
    liveMatches.forEach(m => { if(m && m.id) matchMap.set(m.id, m) });
    
    const allMatches = Array.from(matchMap.values());

    // 3. Filter out generic "Team A/B" or placeholder data
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

    // 4. CLEANUP STALE DATA: Remove matches that are no longer in the Sportradar active feed
    const matchesRef = collection(db, 'matches');
    const existingSnap = await getDocs(matchesRef);
    const deleteBatch = writeBatch(db);
    let deletedCount = 0;

    existingSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const safeId = docSnap.id;
      // Only purge if it's from the Sportradar source and NOT in the current feed
      if (data.source === 'Sportradar' && !apiMatchIds.has(safeId)) {
        deleteBatch.delete(docSnap.ref);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      await deleteBatch.commit();
    }
    
    // 5. UPDATE/CREATE VALID MATCHES
    if (validMatches.length > 0) {
      const updateBatch = writeBatch(db);
      for (const m of validMatches) {
        const safeId = m.id.replace(/:/g, '_');
        const matchRef = doc(db, 'matches', safeId);
        
        let status: 'live' | 'upcoming' | 'finished' = 'upcoming';
        if (m.matchEnded) status = 'finished';
        else if (m.matchStarted) status = 'live';

        const scoreString = m.score 
          ? m.score.map(s => `${s.inning}: ${s.r}`).join(' | ')
          : (status === 'live' ? 'In Progress' : 'Scheduled');

        updateBatch.set(matchRef, {
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

        // Initialize markets
        const marketsRef = collection(db, 'matches', safeId, 'markets');
        updateBatch.set(doc(marketsRef, 'match_winner'), {
          type: 'match_winner',
          status: 'open',
          selections: [
            { id: 'sel_a', name: m.teams[0], odds: 1.90 },
            { id: 'sel_b', name: m.teams[1], odds: 1.90 }
          ]
        }, { merge: true });
      }
      await updateBatch.commit();
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
    // 1. Lock the sync status so background tasks don't immediately re-populate
    const settingsRef = doc(db, 'app_settings', 'global');
    await setDoc(settingsRef, { 
      syncStatus: 'clearing',
      lastGlobalSync: null
    }, { merge: true });

    const matchesRef = collection(db, 'matches');
    const snapshot = await getDocs(matchesRef);
    
    if (snapshot.empty) {
        await setDoc(settingsRef, { syncStatus: 'idle', activeMatchesCount: 0 }, { merge: true });
        return { success: true, count: 0 };
    }
    
    // 2. Perform batched deletion (Firestore limit is 500 per batch)
    const batch = writeBatch(db);
    snapshot.docs.forEach(docSnap => {
      batch.delete(docSnap.ref);
    });
    
    await batch.commit();
    
    // 3. Unlock sync status
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
