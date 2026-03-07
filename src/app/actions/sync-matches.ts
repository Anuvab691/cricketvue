'use client';

import { Firestore, doc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { 
  getCompetitions,
  getEventsByCompetition,
  fetchMarketOdds,
  fetchFancyOdds,
  fetchLiveScores
} from '@/services/cricket-api-service';

/**
 * Master Ingestion Workflow: Implements the full professional hierarchy sync.
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

    // 2. Fetch Hierarchy Layer 2: Live Scores (Base for Event UI)
    const liveMatches = await fetchLiveScores();
    const activeMatchIds = new Set<string>();

    // Pre-fetch all Betfair events to link them
    const allBetfairEvents: any[] = [];
    for (const comp of competitions.slice(0, 10)) { // Limit competitions to avoid timeout
      const events = await getEventsByCompetition(comp.id, '4');
      if (events && Array.isArray(events)) {
        allBetfairEvents.push(...events);
      }
    }

    // 3. Process each Live Match
    for (const matchedMatch of liveMatches) {
      activeMatchIds.add(matchedMatch.id);
      let matchEnrichment = {};

      // Fuzzy match Betfair Event to our Live Match
      const betfairEvent = allBetfairEvents.find(e => {
        const eName = (e.name || '').toLowerCase();
        const mHome = (matchedMatch.teamA || '').toLowerCase();
        const mAway = (matchedMatch.teamB || '').toLowerCase();
        return (eName.includes(mHome) && eName.includes(mAway));
      });

      if (betfairEvent) {
        // Find market odds for the linked event
        const marketOddsResult = await fetchMarketOdds(betfairEvent.id); // Assuming eventId can act as primary market ID or similar fallback
        
        matchEnrichment = {
          betfairEventId: betfairEvent.id,
          odds: marketOddsResult ? {
            status: marketOddsResult.status,
            home: { 
              back: marketOddsResult.runners[0]?.back?.[0]?.price || 1.00, 
              lay: marketOddsResult.runners[0]?.lay?.[0]?.price || 0.00 
            },
            away: { 
              back: marketOddsResult.runners[1]?.back?.[0]?.price || 1.00, 
              lay: marketOddsResult.runners[1]?.lay?.[0]?.price || 0.00 
            },
          } : null
        };
      }

      // Save Match to Firestore (Always save, enriched if possible)
      const matchRef = doc(db, 'matches', matchedMatch.id);
      await setDoc(matchRef, {
        ...matchedMatch,
        ...matchEnrichment,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    }

    // 4. Pruning: Remove stale matches
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

    return { success: true, active: activeMatchIds.size, pruned };
  } catch (error: any) {
    console.error("Master Sync Failure:", error);
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
