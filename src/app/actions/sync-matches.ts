'use client';

import { Firestore, doc, setDoc, collection, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
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
 * Intelligent Sync Engine: Updates matches and professional Betfair odds in real-time.
 * Performs "Upserts" to ensure scores update seamlessly without disappearing,
 * and then prunes stale records that are no longer in the professional feed.
 */
export async function syncCricketMatchesAction(db: Firestore, options: { clearFirst?: boolean } = {}) {
  try {
    // 1. Optional Purge (usually only for manual cleanup)
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

    // 3. Sync Live Matches and Betfair Odds Discovery
    const liveMatchesList = await fetchLiveMatches();
    const competitions = await fetchBetfairCompetitions('4'); // 4 = Cricket

    const currentMatchIds = new Set<string>();
    let syncedCount = 0;

    for (const matchSummary of liveMatchesList) {
      // Respect trial API rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Fetch high-fidelity detail (score structure)
      const matchData = await fetchMatchDetail(matchSummary.id) || matchSummary;
      currentMatchIds.add(matchData.id);

      // Default Odds Schema (Liquidity Placeholder)
      let marketOdds = {
        home: { back: 1.00, lay: 0.00 },
        away: { back: 1.00, lay: 0.00 }
      };

      let discoveredMarketId = null;

      // 4. Betfair Exchange Discovery Protocol (Pulse Chain)
      try {
        const homeTeam = (matchData.teams?.[0] || '').toLowerCase();
        const awayTeam = (matchData.teams?.[1] || '').toLowerCase();
        const seriesName = (matchData.series || '').toLowerCase();

        // Find matching competition
        const matchingComp = competitions.find((c: any) => {
          const cName = (c.competition?.name || '').toLowerCase();
          return seriesName.includes(cName) || cName.includes(seriesName) || 
                 homeTeam.includes(cName) || awayTeam.includes(cName);
        });

        if (matchingComp) {
          const events = await fetchBetfairEvents(matchingComp.competition.id, '4');
          const matchingEvent = events.find((e: any) => {
            const eName = (e.event?.name || '').toLowerCase();
            return eName.includes(homeTeam) || eName.includes(awayTeam);
          });

          if (matchingEvent) {
            const markets = await fetchBetfairMarkets(matchingEvent.event.id, '4');
            const winnerMarket = markets.find((m: any) => 
              ['Match Odds', 'Winner', 'Match Betting'].some(term => m.marketName?.includes(term))
            );
            
            if (winnerMarket) {
              discoveredMarketId = winnerMarket.marketId;
              // Pulse Market Book (POST request)
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
        // Silent fail on odds discovery to keep score updates moving
      }

      // 5. In-Place Update: Triggers real-time UI refresh for the specific document
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

      syncedCount++;
    }

    // 6. Intelligent Pruning: Remove matches from Firestore that are no longer in the live network feed
    const existingMatchesSnap = await getDocs(collection(db, 'matches'));
    const batch = writeBatch(db);
    let pruneCount = 0;

    existingMatchesSnap.docs.forEach(snap => {
      if (!currentMatchIds.has(snap.id)) {
        batch.delete(snap.ref);
        pruneCount++;
      }
    });

    if (pruneCount > 0) {
      await batch.commit();
    }

    return { success: true, count: syncedCount, pruned: pruneCount, tournamentsCount: seriesList.length };
  } catch (error: any) {
    console.error("Professional Pulse Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Manual Deep Purge: Force clears the terminal feed.
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
