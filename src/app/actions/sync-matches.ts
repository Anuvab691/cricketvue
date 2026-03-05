'use client';

import { Firestore, doc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { 
  fetchLiveMatches, 
  fetchMatchDetail, 
  fetchLiveSeries,
  fetchBetfairCompetitions,
  fetchBetfairEvents,
  fetchBetfairMarkets,
  fetchMarketBook
} from '@/services/cricket-api-service';

/**
 * Precision Sync Engine: Updates matches and professional Betfair odds in real-time.
 * Performs deep discovery down to the Market Book via POST listMarketBook.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    // 1. Sync Series (Tournaments)
    const seriesList = await fetchLiveSeries();
    for (const series of seriesList) {
      if (!series.id) continue;
      await setDoc(doc(db, 'tournaments', series.id), {
        ...series,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    }

    // 2. Start Live Match Sync
    const liveMatchesList = await fetchLiveMatches();
    const activeMatchIds = new Set<string>();

    // Discovery Cache: Fetch competitions once
    const competitions = await fetchBetfairCompetitions('4'); 

    for (const matchSummary of liveMatchesList) {
      // Respect trial API rate limits
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const matchData = await fetchMatchDetail(matchSummary.id) || matchSummary;
      activeMatchIds.add(matchData.id);

      // Default Odds 
      let marketOdds = {
        home: { back: 1.00, lay: 0.00 },
        away: { back: 1.00, lay: 0.00 }
      };

      let discoveredMarketId = null;
      let runnerMapping: any[] = [];

      // 3. Betfair Discovery Chain
      try {
        const homeTeam = (matchData.teamA || '').toLowerCase();
        const awayTeam = (matchData.teamB || '').toLowerCase();
        const seriesName = (matchData.series || '').toLowerCase();

        // Step A: Find matching competition
        const matchingComp = competitions.find((c: any) => {
          const name = (c.competition?.name || '').toLowerCase();
          return seriesName.includes(name) || name.includes(seriesName);
        });

        if (matchingComp) {
          // Step B: Fetch Events
          const events = await fetchBetfairEvents(matchingComp.competition.id, '4');
          const matchingEvent = events.find((e: any) => {
            const name = (e.event?.name || '').toLowerCase();
            return name.includes(homeTeam) || name.includes(awayTeam);
          });

          if (matchingEvent) {
            // Step C: Fetch Markets
            const markets = await fetchBetfairMarkets(matchingEvent.event.id, '4');
            const winnerMarket = markets.find((m: any) => 
              ['Match Odds', 'Winner', 'Match Betting'].some(term => 
                (m.marketName || '').toLowerCase().includes(term.toLowerCase())
              )
            );
            
            if (winnerMarket) {
              discoveredMarketId = winnerMarket.marketId;
              runnerMapping = winnerMarket.runners || [];

              // Step D: Fetch Live Market Book via POST
              const book = await fetchMarketBook(discoveredMarketId, '4');
              
              if (book && book.runners) {
                // Precision Match: Link Betfair runners to Team A / Team B by name
                const homeRunner = book.runners.find((r: any) => {
                  const meta = runnerMapping.find(m => m.selectionId === r.selectionId);
                  return (meta?.runnerName || '').toLowerCase().includes(homeTeam);
                }) || book.runners[0];

                const awayRunner = book.runners.find((r: any) => {
                  const meta = runnerMapping.find(m => m.selectionId === r.selectionId);
                  return (meta?.runnerName || '').toLowerCase().includes(awayTeam);
                }) || book.runners[1];

                marketOdds = {
                  home: { 
                    back: homeRunner?.ex?.availableToBack?.[0]?.price || 1.00,
                    lay: homeRunner?.ex?.availableToLay?.[0]?.price || 0.00
                  },
                  away: { 
                    back: awayRunner?.ex?.availableToBack?.[0]?.price || 1.00,
                    lay: awayRunner?.ex?.availableToLay?.[0]?.price || 0.00
                  }
                };
              }
            }
          }
        }
      } catch (discoveryErr) {
        // Fallback to score-only if discovery fails
      }

      // 4. In-Place Update
      const matchRef = doc(db, 'matches', matchData.id);
      await setDoc(matchRef, {
        ...matchData,
        currentScore: matchData.score,
        lastUpdated: new Date().toISOString(),
        odds: marketOdds,
        marketId: discoveredMarketId
      }, { merge: true });

      // Update Market Sub-collection
      const marketSubRef = doc(db, 'matches', matchData.id, 'markets', 'match_winner');
      await setDoc(marketSubRef, {
        id: 'match_winner',
        type: 'match_winner',
        status: 'open',
        selections: [
          { 
            id: 'home', 
            name: matchData.teamA, 
            odds: marketOdds.home.back, 
            layOdds: marketOdds.home.lay || (marketOdds.home.back > 1 ? marketOdds.home.back + 0.02 : 0)
          },
          { 
            id: 'away', 
            name: matchData.teamB, 
            odds: marketOdds.away.back, 
            layOdds: marketOdds.away.lay || (marketOdds.away.back > 1 ? marketOdds.away.back + 0.02 : 0)
          }
        ]
      }, { merge: true });
    }

    // 5. Cleanup Stale Matches (No more no less)
    const existingSnap = await getDocs(collection(db, 'matches'));
    const batch = writeBatch(db);
    let pruned = 0;
    existingSnap.forEach(doc => {
      if (!activeMatchIds.has(doc.id)) {
        batch.delete(doc.ref);
        pruned++;
      }
    });
    if (pruned > 0) await batch.commit();

    return { 
      success: true, 
      count: liveMatchesList.length, 
      tournamentsCount: seriesList.length,
      pruned 
    };
  } catch (error: any) {
    console.error("Precision Sync Error:", error);
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
