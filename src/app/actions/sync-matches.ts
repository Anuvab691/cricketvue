
'use client';

import { doc, setDoc, collection, Firestore, getDocs, writeBatch, getDoc, query, where, deleteDoc } from 'firebase/firestore';
import { fetchLiveMatches } from '@/services/cricket-api-service';

/**
 * Synchronizes live matches from Sportradar API to Firestore.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    const settingsRef = doc(db, 'app_settings', 'global');
    const settingsSnap = await getDoc(settingsRef);
    
    // Check if a global clear is in progress
    if (settingsSnap.exists() && settingsSnap.data().syncStatus === 'clearing') {
      console.log("[Sync] Skipping sync: Database is currently being cleared.");
      return { success: false, reason: 'clearing' };
    }

    console.log("[Sync] Fetching live summaries from Sportradar...");
    const externalMatches = await fetchLiveMatches();

    if (!externalMatches || externalMatches.length === 0) {
      console.log("[Sync] No live matches found in API feed.");
      await updateSyncStatus(db, 'success', 0, 0);
      return { success: true, count: 0 };
    }

    // Filter out placeholders
    const validMatches = externalMatches.filter(m => 
      !m.teams.some(t => t.toLowerCase().includes('team a') || t.toLowerCase().includes('team b'))
    );

    const batch = writeBatch(db);
    let updatedCount = 0;

    for (const match of validMatches) {
      const matchRef = doc(db, 'matches', match.id);
      
      // Calculate Back/Lay Odds from Probabilities
      // Default to 50/50 if not provided
      const probHome = match.probabilities?.home || 50;
      const probAway = match.probabilities?.away || 50;

      // Odds = 100 / Probability
      // Back = Odds * 0.98 (margin)
      // Lay = Odds * 1.02 (spread)
      const homeBack = Math.max(1.01, (100 / probHome) * 0.98);
      const homeLay = Math.max(1.02, (100 / probHome) * 1.02);
      const awayBack = Math.max(1.01, (100 / probAway) * 0.98);
      const awayLay = Math.max(1.02, (100 / probAway) * 1.02);

      // Basic match data
      const matchData = {
        teamA: match.teams[0] || 'TBA',
        teamB: match.teams[1] || 'TBA',
        startTime: match.date,
        status: match.matchEnded ? 'finished' : (match.matchStarted ? 'live' : 'upcoming'),
        statusText: match.rawStatusText || '',
        currentScore: match.score ? match.score.map(s => `${s.inning}: ${s.r}`).join(' | ') : 'TBD',
        venue: match.venue,
        series: match.series || 'International Series',
        lastUpdated: new Date().toISOString(),
        // Add top-level odds for fast dashboard rendering
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
        status: 'open',
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
    
    // Delete matches and their subcollections
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
