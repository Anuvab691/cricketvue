'use client';

import { Firestore, doc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { syncSportsMonkData } from '@/services/cricket-api-service';

/**
 * SportsMonk Data Ingestion: Fetches fixtures and updates terminal state.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    // 1. Fetch live data from SportsMonk v3
    const { leagues, fixtures } = await syncSportsMonkData();
    const activeMatchIds = new Set<string>();

    const batch = writeBatch(db);

    // 2. Process Leagues (Tournaments)
    for (const league of leagues) {
      const leagueRef = doc(db, 'tournaments', league.id);
      batch.set(leagueRef, {
        ...league,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    }

    // 3. Process Fixtures (Matches)
    for (const match of fixtures) {
      activeMatchIds.add(match.id);
      const matchRef = doc(db, 'matches', match.id);
      batch.set(matchRef, {
        ...match,
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      // If odds data is nested but needs separate market storage for scalability
      // Option: fixtures/{matchId}/markets/{marketId}
      if (match.odds) {
        const marketRef = doc(db, 'matches', match.id, 'markets', 'moneyline');
        batch.set(marketRef, {
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

    // 4. Pruning: Remove matches no longer in the live feed
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
      tournamentsCount: leagues.length
    };
  } catch (error: any) {
    console.error("SportsMonk Sync Failure:", error);
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
