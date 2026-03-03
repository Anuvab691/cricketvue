
'use client';

import { doc, setDoc, collection, Firestore, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { fetchLiveMatches, fetchDailySchedule, ExternalMatch } from '@/services/cricket-api-service';

/**
 * Syncs actual real-world cricket data from Sportradar into our Firestore matches collection.
 * Performs a 'True Sync' - removing matches from Firestore that are no longer in the API feed.
 * Fetches a 3-day window (Today, Tomorrow, Day After) to ensure upcoming matches are visible.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    // 1. Prepare date strings for Today, Tomorrow, and Day After
    const datesToSync = [0, 1, 2].map(offset => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return d.toISOString().split('T')[0];
    });

    // 2. Fetch Live Matches and 3-day Schedule in parallel
    const [liveMatches, ...schedules] = await Promise.all([
      fetchLiveMatches(),
      ...datesToSync.map(date => fetchDailySchedule(date))
    ]);

    // 3. Merge matches, prioritizing live ones for the same ID
    const matchMap = new Map<string, ExternalMatch>();
    
    // Process scheduled matches first
    schedules.flat().forEach(m => matchMap.set(m.id, m));
    // Process live matches second (overwriting scheduled ones if they are the same)
    liveMatches.forEach(m => matchMap.set(m.id, m));
    
    const allMatches = Array.from(matchMap.values());

    // 4. Filter out matches with generic/masked names "Team A" or "Team B" 
    const validMatches = allMatches.filter(m => {
      const t1 = (m.teams[0] || '').toLowerCase();
      const t2 = (m.teams[1] || '').toLowerCase();
      const isGeneric = 
        t1.includes('team a') || t1.includes('team b') || 
        t2.includes('team a') || t2.includes('team b') ||
        t1 === 'tba' || t2 === 'tba';
      return !isGeneric;
    });

    const apiMatchIds = new Set(validMatches.map(m => m.id.replace(/:/g, '_')));

    // 5. CLEANUP: Remove matches from Firestore that are not in the current VALID API response window
    const matchesRef = collection(db, 'matches');
    const existingSnap = await getDocs(matchesRef);
    const deleteBatch = writeBatch(db);
    let deletedCount = 0;

    existingSnap.forEach((docSnap) => {
      const data = docSnap.data();
      // Only delete if it's from Sportradar and not in the current 3-day API set
      if (data.source === 'Sportradar' && !apiMatchIds.has(docSnap.id)) {
        deleteBatch.delete(docSnap.ref);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      await deleteBatch.commit();
    }
    
    if (validMatches.length === 0) {
      updateSyncStatus(db, 'success', 0, deletedCount);
      return { success: true, count: 0, deleted: deletedCount };
    }

    // 6. UPDATE/CREATE: Push latest valid data to Firestore
    const batchPromises = validMatches.map(async (m) => {
      const safeId = m.id.replace(/:/g, '_');
      const matchRef = doc(db, 'matches', safeId);
      
      let status: 'live' | 'upcoming' | 'finished' = 'upcoming';
      if (m.matchEnded) {
        status = 'finished';
      } else if (m.matchStarted) {
        status = 'live';
      }

      const scoreString = m.score 
        ? m.score.map(s => `${s.inning}: ${s.r}`).join(' | ')
        : (status === 'live' ? 'In Progress' : 'Scheduled');

      const matchData = {
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
      };

      await setDoc(matchRef, matchData, { merge: true });
        
      // Initialize basic markets if they don't exist
      const marketsRef = collection(db, 'matches', safeId, 'markets');
      const marketsSnap = await getDocs(marketsRef).catch(() => null);
      
      if (marketsSnap && marketsSnap.empty) {
        const winnerMarketRef = doc(marketsRef, 'match_winner');
        await setDoc(winnerMarketRef, {
          type: 'match_winner',
          status: 'open',
          selections: [
            { id: 'sel_a', name: m.teams[0], odds: 1.90 },
            { id: 'sel_b', name: m.teams[1], odds: 1.90 }
          ]
        });
      }
    });

    await Promise.all(batchPromises);

    updateSyncStatus(db, 'success', validMatches.length, deletedCount);
    return { success: true, count: validMatches.length, deleted: deletedCount };
  } catch (error: any) {
    console.error("Sync Internal Failure:", error);
    updateSyncStatus(db, 'error', 0, 0, error.message);
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

/**
 * Completely wipes the matches collection.
 */
export async function clearAllMatchesAction(db: Firestore) {
  try {
    const matchesRef = collection(db, 'matches');
    const snapshot = await getDocs(matchesRef);
    if (snapshot.empty) return { success: true, count: 0 };
    const deletePromises = snapshot.docs.map(mDoc => deleteDoc(mDoc.ref));
    await Promise.all(deletePromises);
    return { success: true, count: snapshot.size };
  } catch (error: any) {
    return { error: error.message };
  }
}
