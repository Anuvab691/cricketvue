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
 * Integrated Sync Engine: Synchronizes Matches and Tournaments with Betfair Exchange integration.
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

    // 2. Betfair Discovery Pulse
    const competitions = await fetchBetfairCompetitions();
    const liveMatches = await fetchLiveMatches();

    let syncedCount = 0;
    for (const match of liveMatches) {
      // Trial Key Rate-Limit Protection (1.2s delay)
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      if (!match.id) continue;
      
      // Targeted Deep-Sync for scores
      const detail = await fetchMatchDetail(match.id);
      const matchData = detail || match;

      // Default Odds Schema (Fallback)
      let marketOdds = {
        home: { back: 1.90, lay: 1.92 },
        away: { back: 1.90, lay: 1.92 }
      };

      // 3. Betfair Market Discovery Chain
      try {
        const matchingComp = competitions.find((c: any) => 
          matchData.series?.toLowerCase().includes(c.competition?.name?.toLowerCase()) ||
          c.competition?.name?.toLowerCase().includes(matchData.series?.toLowerCase())
        );

        if (matchingComp) {
          const events = await fetchBetfairEvents(matchingComp.competition.id);
          const matchingEvent = events.find((e: any) => 
            e.event.name.toLowerCase().includes(matchData.teams[0].toLowerCase()) ||
            e.event.name.toLowerCase().includes(matchData.teams[1].toLowerCase())
          );

          if (matchingEvent) {
            const markets = await fetchBetfairMarkets(matchingEvent.event.id);
            const winnerMarket = markets.find((m: any) => m.marketName === 'Match Odds');
            
            if (winnerMarket) {
              const book = await fetchMarketBook(winnerMarket.marketId);
              if (book && book.runners && book.runners.length >= 2) {
                // Extract proper Back and Lay odds from the Betfair Pulse
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
        console.warn(`Betfair Sync skipped for ${matchData.name}:`, betfairErr);
      }

      // 4. Persistence Phase
      const matchRef = doc(db, 'matches', matchData.id);
      await setDoc(matchRef, {
        ...matchData,
        currentScore: matchData.score, // Map for UI consistency
        lastUpdated: new Date().toISOString(),
        odds: marketOdds
      }, { merge: true });

      // Create Market sub-collection for granular betting
      const marketRef = doc(db, 'matches', matchData.id, 'markets', 'match_winner');
      await setDoc(marketRef, {
        id: 'match_winner',
        type: 'match_winner',
        status: 'open',
        selections: [
          { id: 'home', name: matchData.teams[0], odds: marketOdds.home.back, layOdds: marketOdds.home.lay },
          { id: 'away', name: matchData.teams[1], odds: marketOdds.away.back, layOdds: marketOdds.away.lay }
        ]
      }, { merge: true });

      syncedCount++;
    }

    return { success: true, count: syncedCount, tournamentsCount: seriesList.length };
  } catch (error: any) {
    console.error("Terminal Sync Engine Failure:", error);
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
