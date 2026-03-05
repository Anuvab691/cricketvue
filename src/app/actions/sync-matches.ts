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
 * Ensures the terminal shows "no more, no less" than what is currently live.
 */
export async function syncCricketMatchesAction(db: Firestore, options: { clearFirst?: boolean } = {}) {
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

    // Discovery Cache: Fetch competitions once to save API calls
    const competitions = await fetchBetfairCompetitions('4'); // 4 = Cricket

    for (const matchSummary of liveMatchesList) {
      // Respect API rate limits (Trial Key: ~2 req/sec)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const matchData = await fetchMatchDetail(matchSummary.id) || matchSummary;
      activeMatchIds.add(matchData.id);

      // Default Odds Placeholder
      let marketOdds = {
        home: { back: 1.00, lay: 0.00 },
        away: { back: 1.00, lay: 0.00 }
      };

      let discoveredMarketId = null;

      // 3. Betfair Exchange Discovery Protocol
      try {
        const homeTeam = (matchData.teams?.[0] || '').toLowerCase();
        const awayTeam = (matchData.teams?.[1] || '').toLowerCase();
        const seriesName = (matchData.series || '').toLowerCase();

        // Step A: Match competition
        const matchingComp = competitions.find((c: any) => {
          const cName = (c.competition?.name || '').toLowerCase();
          return seriesName.includes(cName) || cName.includes(seriesName) || 
                 homeTeam.includes(cName) || awayTeam.includes(cName);
        });

        if (matchingComp) {
          // Step B: Fetch Events
          const events = await fetchBetfairEvents(matchingComp.competition.id, '4');
          const matchingEvent = events.find((e: any) => {
            const eName = (e.event?.name || '').toLowerCase();
            return eName.includes(homeTeam) || eName.includes(awayTeam);
          });

          if (matchingEvent) {
            // Step C: Fetch Markets
            const markets = await fetchBetfairMarkets(matchingEvent.event.id, '4');
            const winnerMarket = markets.find((m: any) => 
              ['Match Odds', 'Winner', 'Match Betting', 'Match Winner'].some(term => 
                (m.marketName || '').toLowerCase().includes(term.toLowerCase())
              )
            );
            
            if (winnerMarket) {
              discoveredMarketId = winnerMarket.marketId;
              // Step D: Fetch Live Market Book via POST
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
        // Silent fail on discovery steps to allow score-only sync
      }

      // 4. In-Place Update: Stable ID ensures no duplicates when score changes
      const matchRef = doc(db, 'matches', matchData.id);
      await setDoc(matchRef, {
        ...matchData,
        currentScore: matchData.score,
        lastUpdated: new Date().toISOString(),
        odds: marketOdds,
        marketId: discoveredMarketId
      }, { merge: true });

      // Update Market Sub-collection for the detail view
      const marketSubRef = doc(db, 'matches', matchData.id, 'markets', 'match_winner');
      await setDoc(marketSubRef, {
        id: 'match_winner',
        type: 'match_winner',
        status: 'open',
        selections: [
          { 
            id: 'home', 
            name: matchData.teams?.[0] || 'Team A', 
            odds: marketOdds.home.back, 
            layOdds: marketOdds.home.lay || (marketOdds.home.back > 1 ? marketOdds.home.back + 0.02 : 0)
          },
          { 
            id: 'away', 
            name: matchData.teams?.[1] || 'Team B', 
            odds: marketOdds.away.back, 
            layOdds: marketOdds.away.lay || (marketOdds.away.back > 1 ? marketOdds.away.back + 0.02 : 0)
          }
        ]
      }, { merge: true });
    }

    // 5. "No More No Less" Pruning: Remove matches that are no longer active in the professional feed
    const existingMatchesSnap = await getDocs(collection(db, 'matches'));
    const pruneBatch = writeBatch(db);
    let prunedCount = 0;

    existingMatchesSnap.docs.forEach(doc => {
      if (!activeMatchIds.has(doc.id)) {
        pruneBatch.delete(doc.ref);
        prunedCount++;
      }
    });
    
    if (prunedCount > 0) {
      await pruneBatch.commit();
    }

    return { 
      success: true, 
      count: liveMatchesList.length, 
      tournamentsCount: seriesList.length,
      prunedCount 
    };
  } catch (error: any) {
    console.error("Professional Sync Error:", error);
    return { success: false, error: error.message };
  }
}
