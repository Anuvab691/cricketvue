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
 * Integrated Sync Engine: Synchronizes Matches and Tournaments with a resilient Betfair Discovery Chain.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    // 1. Sync Series (Tournaments) - Primary Pulse
    const seriesList = await fetchLiveSeries();
    for (const series of seriesList) {
      if (!series.id) continue;
      await setDoc(doc(db, 'tournaments', series.id), {
        ...series,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    }

    // 2. Initial Data Gathering: Live Matches and Betfair Competitions
    const liveMatchesList = await fetchLiveMatches();
    const competitions = await fetchBetfairCompetitions('4'); // Sport ID 4 for Cricket

    let syncedCount = 0;
    for (const matchSummary of liveMatchesList) {
      // Trial Key Rate-Limit Protection (1.5s delay ensures stable discovery chain)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Fetch high-fidelity detail for the match (t1/t2 structure)
      const matchData = await fetchMatchDetail(matchSummary.id) || matchSummary;

      // Default Odds Schema (Standard fallback if market mapping fails)
      let marketOdds = {
        home: { back: 1.00, lay: 0.00 },
        away: { back: 1.00, lay: 0.00 }
      };

      let discoveredMarketId = null;

      // 3. Betfair Exchange Pulse: The Discovery Chain
      try {
        const homeTeam = matchData.teams[0].toLowerCase();
        const awayTeam = matchData.teams[1].toLowerCase();
        const seriesName = (matchData.series || '').toLowerCase();

        // Step A: Discovery Phase - Find matching competition
        const matchingComp = competitions.find((c: any) => {
          const cName = (c.competition?.name || '').toLowerCase();
          return seriesName.includes(cName) || cName.includes(seriesName) || 
                 homeTeam.includes(cName) || awayTeam.includes(cName);
        });

        // Step B: Event Phase - If competition identified, fetch its events
        if (matchingComp) {
          const events = await fetchBetfairEvents(matchingComp.competition.id, '4');
          const matchingEvent = events.find((e: any) => {
            const eName = (e.event?.name || '').toLowerCase();
            return eName.includes(homeTeam) || eName.includes(awayTeam);
          });

          // Step C: Market Phase - If event identified, fetch available markets
          if (matchingEvent) {
            const markets = await fetchBetfairMarkets(matchingEvent.event.id, '4');
            // Specifically target the "Match Odds" market
            const winnerMarket = markets.find((m: any) => 
              m.marketName === 'Match Odds' || m.marketName === 'Winner' || m.marketName === 'Match Betting'
            );
            
            // Step D: Book Phase - Fetch real-time prices (Back/Lay)
            if (winnerMarket) {
              discoveredMarketId = winnerMarket.marketId;
              const book = await fetchMarketBook(discoveredMarketId, '4');
              
              if (book && book.runners && book.runners.length >= 2) {
                // Map runners to home/away based on name matching or order
                // Runners[0] is typically Selection 1 (Home), Runners[1] is Selection 2 (Away)
                marketOdds = {
                  home: { 
                    back: book.runners[0]?.ex?.availableToBack?.[0]?.price || 1.00,
                    lay: book.runners[0]?.ex?.availableToLay?.[0]?.price || 0.00
                  },
                  away: { 
                    back: book.runners[1]?.ex?.availableToBack?.[0]?.price || 1.00,
                    lay: book.runners[1]?.ex?.availableToLay?.[0]?.price || 0.00
                  }
                };
              }
            }
          }
        }
      } catch (betfairErr) {
        console.warn(`Discovery Chain Pulse interrupted for ${matchData.name}:`, betfairErr);
      }

      // 4. Persistence Phase: Save to Match Terminal
      const matchRef = doc(db, 'matches', matchData.id);
      await setDoc(matchRef, {
        ...matchData,
        currentScore: matchData.score,
        lastUpdated: new Date().toISOString(),
        odds: marketOdds,
        marketId: discoveredMarketId
      }, { merge: true });

      // Update Sub-Collection for betting
      const marketSubRef = doc(db, 'matches', matchData.id, 'markets', 'match_winner');
      await setDoc(marketSubRef, {
        id: 'match_winner',
        type: 'match_winner',
        status: 'open',
        selections: [
          { 
            id: 'home', 
            name: matchData.teams[0], 
            odds: marketOdds.home.back, 
            layOdds: marketOdds.home.lay || marketOdds.home.back + 0.02 
          },
          { 
            id: 'away', 
            name: matchData.teams[1], 
            odds: marketOdds.away.back, 
            layOdds: marketOdds.away.lay || marketOdds.away.back + 0.02 
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
 * Deep Purge: Clears all matches and tournaments from the terminal.
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
