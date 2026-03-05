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
 * Includes "Fresh Slate" support to auto-purge stale records.
 */
export async function syncCricketMatchesAction(db: Firestore, options: { clearFirst?: boolean } = {}) {
  try {
    // 1. Fresh Slate Protocol: Clear existing matches to avoid "old scores" or stale data.
    if (options.clearFirst) {
      await clearAllMatchesAction(db);
    }

    // 2. Sync Series (Tournaments)
    const seriesList = await fetchLiveSeries();
    for (const series of seriesList) {
      if (!series.id) continue;
      await setDoc(doc(db, 'tournaments', series.id), {
        ...series,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    }

    // 3. Gathering Live Matches and Betfair Discovery Chain
    const liveMatchesList = await fetchLiveMatches();
    const competitions = await fetchBetfairCompetitions('4'); // Sport ID 4 for Cricket

    let syncedCount = 0;
    for (const matchSummary of liveMatchesList) {
      // Respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Fetch high-fidelity detail for the match (t1/t2 structure)
      const matchData = await fetchMatchDetail(matchSummary.id) || matchSummary;

      // Default Odds Schema (Liquidity Placeholder)
      let marketOdds = {
        home: { back: 1.00, lay: 0.00 },
        away: { back: 1.00, lay: 0.00 }
      };

      let discoveredMarketId = null;

      // 4. Betfair Exchange Discovery Protocol
      try {
        const homeTeam = matchData.teams[0].toLowerCase();
        const awayTeam = matchData.teams[1].toLowerCase();
        const seriesName = (matchData.series || '').toLowerCase();

        // Step A: Match competition by series or team name
        const matchingComp = competitions.find((c: any) => {
          const cName = (c.competition?.name || '').toLowerCase();
          return seriesName.includes(cName) || cName.includes(seriesName) || 
                 homeTeam.includes(cName) || awayTeam.includes(cName);
        });

        if (matchingComp) {
          // Step B: Discover Event
          const events = await fetchBetfairEvents(matchingComp.competition.id, '4');
          const matchingEvent = events.find((e: any) => {
            const eName = (e.event?.name || '').toLowerCase();
            return eName.includes(homeTeam) || eName.includes(awayTeam);
          });

          if (matchingEvent) {
            // Step C: Discover Winner Market
            const markets = await fetchBetfairMarkets(matchingEvent.event.id, '4');
            const winnerMarket = markets.find((m: any) => 
              ['Match Odds', 'Winner', 'Match Betting'].some(term => m.marketName.includes(term))
            );
            
            if (winnerMarket) {
              discoveredMarketId = winnerMarket.marketId;
              // Step D: Pulse Market Book (POST request)
              const book = await fetchMarketBook(discoveredMarketId, '4');
              
              if (book && book.runners && book.runners.length >= 2) {
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
        console.warn(`Betfair Pulse interrupted for ${matchData.id}`);
      }

      // 5. Persistence Phase: Save to Terminal
      const matchRef = doc(db, 'matches', matchData.id);
      await setDoc(matchRef, {
        ...matchData,
        currentScore: matchData.score,
        lastUpdated: new Date().toISOString(),
        odds: marketOdds,
        marketId: discoveredMarketId
      }, { merge: true });

      // Market Sub-collection Update
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
    console.error("Terminal Sync Error:", error);
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
