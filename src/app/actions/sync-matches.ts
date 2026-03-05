'use client';

import { doc, setDoc, collection, Firestore, getDocs, writeBatch, getDoc } from 'firebase/firestore';
import { fetchLiveMatches, fetchCompetitions, fetchMatchDetail } from '@/services/cricket-api-service';

/**
 * Professional-grade sync engine with sequential rate-limiting for Trial API.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    const settingsRef = doc(db, 'app_settings', 'global');
    const settingsSnap = await getDoc(settingsRef);
    
    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      if (data.syncStatus === 'clearing') return { success: false, reason: 'clearing' };
      const lastSync = data.lastGlobalSync ? new Date(data.lastGlobalSync).getTime() : 0;
      
      // Concurrency Lock: Minimum 8s between network pulses
      if (Date.now() - lastSync < 8000) {
        return { success: true, reason: 'recent' };
      }
    }

    // 1. Discovery: Get all live matches from network
    const liveMatchesOverview = await fetchLiveMatches();
    const competitions = await fetchCompetitions();

    if (liveMatchesOverview.length === 0 && competitions.length === 0) {
      return { success: false, reason: 'no-data' };
    }

    // 2. Sync Tournaments
    const tournamentBatch = writeBatch(db);
    competitions.forEach(t => {
      const tRef = doc(db, 'tournaments', t.id);
      tournamentBatch.set(tRef, { ...t, lastUpdated: new Date().toISOString() }, { merge: true });
    });
    await tournamentBatch.commit();

    // 3. Deep Sync: Fetch details for each live match sequentially
    const batch = writeBatch(db);
    let updatedCount = 0;

    for (const overview of liveMatchesOverview) {
      // Respect Trial API Rate Limit (1s delay between detail calls)
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      const match = await fetchMatchDetail(overview.id);
      if (!match) continue;

      const matchRef = doc(db, 'matches', match.id);
      
      // Market Odds Jitter for Trial Data
      const baseOdds = 1.90;
      const jitter = (Math.random() * 0.06) - 0.03;

      const matchData: any = {
        ...match,
        teamA: match.teams[0],
        teamB: match.teams[1],
        startTime: match.date,
        currentScore: match.score || '0/0',
        lastUpdated: new Date().toISOString(),
        odds: {
          home: { back: baseOdds + jitter, lay: (baseOdds + jitter) + 0.02 },
          away: { back: (3.95 - baseOdds) - jitter, lay: ((3.95 - baseOdds) - jitter) + 0.02 }
        }
      };

      batch.set(matchRef, matchData, { merge: true });
      updatedCount++;

      // Initialize Winner Market
      const marketRef = doc(collection(db, 'matches', match.id, 'markets'), 'match_winner');
      batch.set(marketRef, {
        id: 'match_winner',
        type: 'match_winner',
        status: 'open',
        selections: [
          { id: 'home', name: matchData.teamA, odds: matchData.odds.home.back },
          { id: 'away', name: matchData.teamB, odds: matchData.odds.away.back }
        ]
      }, { merge: true });
    }

    await batch.commit();

    // 4. Update Global Telemetry
    await setDoc(settingsRef, { 
      lastGlobalSync: new Date().toISOString(),
      activeMatchesCount: updatedCount,
      syncStatus: 'success'
    }, { merge: true });

    return { success: true, count: updatedCount, tournamentsCount: competitions.length };
  } catch (error: any) {
    console.error("Sportbex Sync Failure:", error);
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
        const marketsSnap = await getDocs(collection(db, col, docSnap.id, 'markets'));
        const b = writeBatch(db);
        marketsSnap.docs.forEach(d => b.delete(d.ref));
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
