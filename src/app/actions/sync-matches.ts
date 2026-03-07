'use client';

import { Firestore, doc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { 
  getCompetitions,
  getEventsByCompetition,
  fetchMarketOdds,
  fetchFancyOdds,
  fetchPremiumFancy,
  fetchLiveScores
} from '@/services/cricket-api-service';

/**
 * Master Ingestion Workflow: Implements the full professional hierarchy sync.
 * Flow: Competitions -> Events -> Markets -> Odds -> Firestore.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    console.log("Starting Master Ingestion Workflow...");
    
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

    // 3. Discovery Chain: Link Betfair Events to Live Matches
    for (const comp of competitions) {
      const events = await getEventsByCompetition(comp.id, '4');
      if (!events || !Array.isArray(events)) continue;

      for (const betfairEvent of events) {
        const e = betfairEvent.event;
        if (!e || !e.name) continue;

        // Fuzzy match Betfair Event name to our Live Match list
        const matchedMatch = liveMatches.find(m => {
          const mName = m.name.toLowerCase();
          const eName = e.name.toLowerCase();
          return eName.includes(mName) || mName.includes(eName) || 
                 (eName.includes(m.teamA.toLowerCase()) && eName.includes(m.teamB.toLowerCase()));
        });

        if (matchedMatch) {
          activeMatchIds.add(matchedMatch.id);
          
          // Select professional MarketId (Hierarchy Layer 3)
          const targetMarketNames = ['match odds', 'match winner', 'winner'];
          const market = betfairEvent.markets?.find((m: any) => 
            targetMarketNames.some(name => (m.marketName || '').toLowerCase().includes(name))
          ) || betfairEvent.markets?.[0];

          if (market) {
            // Hierarchy Layer 4: Odds Pulse
            const marketBook = await fetchMarketOdds(market.marketId);
            
            // Save Market & Odds to Nested Sub-collection
            if (marketBook) {
              const marketRef = doc(db, 'matches', matchedMatch.id, 'markets', 'match_winner');
              await setDoc(marketRef, {
                ...marketBook,
                type: 'match_winner',
                lastUpdated: new Date().toISOString()
              }, { merge: true });

              // Update top-level match with Betfair metadata and current price summary
              const matchRef = doc(db, 'matches', matchedMatch.id);
              await setDoc(matchRef, {
                ...matchedMatch,
                betfairEventId: e.id,
                betfairMarketId: market.marketId,
                odds: {
                  status: marketBook.status,
                  home: { back: marketBook.runners[0]?.back?.[0]?.price || 1.00, lay: marketBook.runners[0]?.lay?.[0]?.price || 0.00 },
                  away: { back: marketBook.runners[1]?.back?.[0]?.price || 1.00, lay: marketBook.runners[1]?.lay?.[0]?.price || 0.00 },
                },
                lastUpdated: new Date().toISOString()
              }, { merge: true });
            }

            // Sync High-Frequency Micro Markets (Fancy/Bookmaker)
            const fancy = await fetchFancyOdds(e.id, '4');
            if (fancy?.bookmaker) {
               await setDoc(doc(db, 'matches', matchedMatch.id, 'markets', 'bookmaker'), {
                 id: 'bookmaker',
                 type: 'bookmaker',
                 selections: fancy.bookmaker.map((b: any) => ({ name: b.runnerName, odds: b.backPrice || 1.00, layOdds: b.layPrice || 0.00 }))
               }, { merge: true });
            }
          }
        }
      }
    }

    // 4. Pruning: No More, No Less (Remove stale matches)
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
