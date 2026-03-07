'use client';

import { Firestore, doc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { syncSportbexData } from '@/services/cricket-api-service';

/**
 * Sportbex Data Ingestion: Fetches live matches and updates terminal state.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    // 1. Fetch live data from Sportbex
    const { fixtures } = await syncSportbexData();
    const activeMatchIds = new Set<string>();

    const batch = writeBatch(db);

    // 2. Process Fixtures (Matches)
    for (const match of fixtures) {
      activeMatchIds.add(match.id);
      const matchRef = doc(db, 'matches', match.id);
      
      // Upsert fixture data
      batch.set(matchRef, {
        ...match,
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      // Create a default market if odds exist in our normalized object
      if (match.odds) {
        const marketRef = doc(db, 'matches', match.id, 'markets', 'moneyline');
        batch.set(marketRef, {
          id: 'moneyline',
          type: 'match_winner',
          status: match.odds.status,
          selections: [
            { id: 'home', name: match.teamA, backLiquidity: match.odds.home.back, layLiquidity: match.odds.home.lay },
            { id: 'away', name: match.teamB, backLiquidity: match.odds.away.back, layLiquidity: match.odds.away.lay }
          ],
          lastUpdated: new Date().toISOString()
        }, { merge: true });
      }
    }

    await batch.commit();

    // 3. Pruning: Remove matches no longer in the live feed (optional, depends on use-case)
    // For now, we only keep live matches in the terminal dashboard
    const existingSnap = await getDocs(collection(db, 'matches'));
    const pruneBatch = writeBatch(db);
    let prunedCount = 0;
    
    existingSnap.forEach(docSnap => {
      if (!activeMatchIds.has(docSnap.id)) {
        pruneBatch.delete(docSnap.ref);
        prunedCount++;
      }
    });

    if (prunedCount > 0) {
      await pruneBatch.commit();
    }

    return { 
      success: true, 
      count: activeMatchIds.size, 
      pruned: prunedCount,
      tournamentsCount: 0 // Sportbex live endpoint doesn't return separate league objects
    };
  } catch (error: any) {
    console.error("Sportbex Sync Failure:", error);
    return { success: false, error: error.message };
  }
}

export async function clearAllMatchesAction(db: Firestore) {
  try {
    const querySnapshot = await getDocs(collection(db, 'matches'));
    const batch = writeBatch(db);
    querySnapshot.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
