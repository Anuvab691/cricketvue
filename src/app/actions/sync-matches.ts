'use client';

import { Firestore, doc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { 
  getCompetitions,
  getEventsByCompetition,
  getMarketsByEvent,
  fetchMarketOdds,
  fetchLiveScores
} from '@/services/cricket-api-service';

/**
 * Master Ingestion Workflow: Implements the full hierarchy sync via SportsGameOdds.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    // 1. Fetch Hierarchy Layer 1: Competitions
    const competitions = await getCompetitions('4');
    for (const comp of competitions) {
      await setDoc(doc(db, 'tournaments', comp.id), {
        ...comp,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    }

    // 2. Fetch Hierarchy Layer 2: Live Scores
    const liveMatches = await fetchLiveScores();
    const activeMatchIds = new Set<string>();

    // Discovery Cache
    const allEvents: any[] = [];
    const limitedComps = competitions.slice(0, 8); // Performance cap

    for (const comp of limitedComps) {
      const events = await getEventsByCompetition(comp.id, '4');
      if (events && Array.isArray(events)) {
        allEvents.push(...events);
      }
    }

    // 3. Process and Link Data
    for (const matchedMatch of liveMatches) {
      activeMatchIds.add(matchedMatch.id);
      let enrichment: any = {};

      // Match Live Score to professional Betfair Event
      const professionalEvent = allEvents.find(e => {
        const eName = (e.name || '').toLowerCase();
        const mHome = (matchedMatch.teamA || '').toLowerCase();
        const mAway = (matchedMatch.teamB || '').toLowerCase();
        return (eName.includes(mHome) && eName.includes(mAway));
      });

      if (professionalEvent) {
        enrichment.betfairEventId = professionalEvent.id;
        
        // Find specific Match Odds market
        const markets = await getMarketsByEvent(professionalEvent.id, '4');
        const matchWinnerMarket = markets.find(m => {
          const name = (m.name || '').toLowerCase();
          return name.includes('match odds') || name.includes('match winner') || name === 'winner';
        });

        if (matchWinnerMarket) {
          enrichment.betfairMarketId = matchWinnerMarket.id;
          const liveOdds = await fetchMarketOdds(matchWinnerMarket.id);
          if (liveOdds) {
             enrichment.odds = liveOdds;
          }
        }
      }

      // Save to Firestore
      const matchRef = doc(db, 'matches', matchedMatch.id);
      await setDoc(matchRef, {
        ...matchedMatch,
        ...enrichment,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    }

    // 4. Pruning
    const existingSnap = await getDocs(collection(db, 'matches'));
    const batch = writeBatch(db);
    let pruned = 0;
    existingSnap.forEach(docSnap => {
      if (!activeMatchIds.has(docSnap.id)) {
        batch.delete(docSnap.ref);
        pruned++;
      }
    });
    if (pruned > 0) await batch.commit();

    return { success: true, count: activeMatchIds.size, pruned };
  } catch (error: any) {
    console.error("SGO Master Sync Failure:", error);
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
