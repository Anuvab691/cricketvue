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
 * Integrated Sync Engine: Synchronizes Matches and Tournaments with full Betfair Exchange Discovery Chain.
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

    // 2. Initial Data Gathering
    const liveMatchesList = await fetchLiveMatches();
    const competitions = await fetchBetfairCompetitions('4'); // Sport ID 4 for Cricket

    let syncedCount = 0;
    for (const matchSummary of liveMatchesList) {
      // Trial Key Rate-Limit Protection (1.5s delay to ensure stable discovery chain)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Fetch deep detail for the t1/t2 structure
      const matchData = await fetchMatchDetail(matchSummary.id) || matchSummary;

      // Default Odds Schema (Standard fallback if market not found)
      let marketOdds = {
        home: { back: 1.90, lay: 1.92 },
        away: { back: 1.90, lay: 1.92 }
      };

      // 3. Betfair Pulse: Discovery Chain
      try {
        const homeTeam = matchData.teams[0].toLowerCase();
        const awayTeam = matchData.teams[1].toLowerCase();
        const seriesName = (matchData.series || '').toLowerCase();

        // Step A: Find matching competition
        const matchingComp = competitions.find((c: any) => {
          const cName = (c.competition?.name || '').toLowerCase();
          return seriesName.includes(cName) || cName.includes(seriesName);
        });

        if (matchingComp) {
          // Step B: Find event in the identified competition
          const events = await fetchBetfairEvents(matchingComp.competition.id, '4');
          const matchingEvent = events.find((e: any) => {
            const eName = (e.event?.name || '').toLowerCase();
            return eName.includes(homeTeam) || eName.includes(awayTeam);
          });

          if (matchingEvent) {
            // Step C: Find markets for the identified event
            const markets = await fetchBetfairMarkets(matchingEvent.event.id, '4');
            // Filter specifically for the "Match Odds" market
            const winnerMarket = markets.find((m: any) => 
              m.marketName === 'Match Odds' || m.marketName === 'Winner'
            );
            
            if (winnerMarket) {
              // Step D: Fetch live book (real-time prices) for the market
              const book = await fetchMarketBook(winnerMarket.marketId, '4');
              if (book && book.runners && book.runners.length >= 2) {
                // Runners[0] usually maps to selection 1, Runners[1] to selection 2
                // We extract the top Back and Lay prices
                marketOdds = {
                  home: { 
                    back: book.runners[0]?.ex?.availableToBack?.[0]?.price || 1.90,
                    lay: book.runners[0]?.ex?.availableToLay?.[0]?.price || 1.92
                  },
                  away: { 
                    back: book.runners[1]?.ex?.availableToBack?.[0]?.price || 1.90,
                    lay: book.runners[1]?.ex?.availableToLay?.[0]?.price || 1.92
                  }
                };
              }
            }
          }
        }
      } catch (betfairErr) {
        console.warn(`Betfair Discovery Chain interrupted for ${matchData.name}:`, betfairErr);
      }

      // 4. Persistence Phase
      const matchRef = doc(db, 'matches', matchData.id);
      await setDoc(matchRef, {
        ...matchData,
        currentScore: matchData.score,
        lastUpdated: new Date().toISOString(),
        odds: marketOdds
      }, { merge: true });

      // Populate Markets sub-collection for granular betting and detailed view
      const marketRef = doc(db, 'matches', matchData.id, 'markets', 'match_winner');
      await setDoc(marketRef, {
        id: 'match_winner',
        type: 'match_winner',
        status: 'open',
        selections: [
          { 
            id: 'home', 
            name: matchData.teams[0], 
            odds: marketOdds.home.back, 
            layOdds: marketOdds.home.lay 
          },
          { 
            id: 'away', 
            name: matchData.teams[1], 
            odds: marketOdds.away.back, 
            layOdds: marketOdds.away.lay 
          }
        ]
      }, { merge: true });

      syncedCount++;
    }

    return { success: true, count: syncedCount, tournamentsCount: seriesList.length };
  } catch (error: any) {
    console.error("Terminal Sync Engine Critical Failure:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Deep Purge: Clears all matches and tournaments from the terminal to reset state.
 */
export async function clearAllMatchesAction(db: Firestore) {
  try {
    const matchesSnap = await getDocs(collection(db, 'matches'));
    const tournamentsSnap = await getDocs(collection(db, 'tournaments'));
    const batch = writeBatch(db);
    
    matchesSnap.docs.forEach(doc => batch.delete(doc.ref));
    tournamentsSnap.docs.forEach(doc => batch.delete(doc.ref));
    
    await batch.commit();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}