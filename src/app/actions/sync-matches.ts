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
 * Sync Engine: Synchronizes Matches and Tournaments with Betfair Market integration.
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

    // 2. Fetch Discovery Data (Betfair Chain)
    const competitions = await fetchBetfairCompetitions();
    const liveMatches = await fetchLiveMatches();

    let syncedCount = 0;
    for (const match of liveMatches) {
      // Avoid hitting rate limits (Trial Keys are sensitive)
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      if (!match.id) continue;
      
      const detail = await fetchMatchDetail(match.id);
      const matchData = detail || match;

      // Betfair Market Discovery
      let marketOdds = {
        home: { back: 1.90, lay: 1.92 },
        away: { back: 1.90, lay: 1.92 }
      };

      // Try to find a matching Betfair market for this event
      try {
        // This is a simplified discovery logic for the terminal
        const comp = competitions.find((c: any) => matchData.series?.toLowerCase().includes(c.competition?.name?.toLowerCase()));
        if (comp) {
          const events = await fetchBetfairEvents(comp.competition.id);
          const event = events.find((e: any) => 
            e.event.name.toLowerCase().includes(matchData.teams[0].toLowerCase()) ||
            e.event.name.toLowerCase().includes(matchData.teams[1].toLowerCase())
          );

          if (event) {
            const markets = await fetchBetfairMarkets(event.event.id);
            const winnerMarket = markets.find((m: any) => m.marketName === 'Match Odds');
            if (winnerMarket) {
              const book = await fetchMarketBook(winnerMarket.marketId);
              if (book && book.runners) {
                // Map Betfair prices to local odds schema
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
      } catch (marketErr) {
        console.warn("Market Discovery failed for match:", matchData.name);
      }

      const matchRef = doc(db, 'matches', matchData.id);
      await setDoc(matchRef, {
        ...matchData,
        lastUpdated: new Date().toISOString(),
        odds: marketOdds
      }, { merge: true });

      // Create Match Winner market sub-collection
      const marketRef = doc(db, 'matches', matchData.id, 'markets', 'match_winner');
      await setDoc(marketRef, {
        id: 'match_winner',
        type: 'match_winner',
        status: 'open',
        selections: [
          { id: 'home', name: matchData.teams[0], odds: marketOdds.home.back },
          { id: 'away', name: matchData.teams[1], odds: marketOdds.away.back }
        ]
      }, { merge: true });

      syncedCount++;
    }

    return { success: true, count: syncedCount };
  } catch (error: any) {
    console.error("Sync Engine Failure:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Deep Purge: Clears all matches and tournaments.
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
