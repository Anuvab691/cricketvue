'use client';

import { Firestore, doc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { 
  fetchLiveMatches, 
  fetchMatchDetail, 
  fetchLiveSeries,
  fetchBetfairCompetitions,
  fetchBetfairEvents,
  fetchMarketOdds,
  fetchFancyOdds,
  fetchPremiumFancy
} from '@/services/cricket-api-service';

/**
 * Precision Sync Engine: Follows the Betfair listMarketBook Protocol.
 * 1. competitions -> 2. events -> 3. marketIds -> 4. listMarketBook (POST)
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    // 1. Sync Series (Tournaments)
    const seriesList = await fetchLiveSeries();
    for (const series of seriesList) {
      if (!series.id) continue;
      setDoc(doc(db, 'tournaments', series.id), {
        ...series,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    }

    // 2. Start Live Match Sync
    const liveMatchesList = await fetchLiveMatches();
    const activeMatchIds = new Set<string>();

    const competitions = await fetchBetfairCompetitions('4'); 

    const matchToMarketMap = new Map<string, string>();
    const runnerMetadataMap = new Map<string, any[]>();
    const matchToEventMap = new Map<string, string>();

    for (const matchSummary of liveMatchesList) {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const matchData = await fetchMatchDetail(matchSummary.id) || matchSummary;
      activeMatchIds.add(matchData.id);

      try {
        const homeTeam = (matchData.teamA || '').toLowerCase();
        const awayTeam = (matchData.teamB || '').toLowerCase();
        const seriesName = (matchData.series || '').toLowerCase();

        const matchingComp = competitions.find((c: any) => {
          const name = (c.competition?.name || '').toLowerCase();
          return seriesName.includes(name) || name.includes(seriesName);
        });

        if (matchingComp) {
          const events = await fetchBetfairEvents(matchingComp.competition.id, '4');
          const matchingEvent = events.find((e: any) => {
            const name = (e.event?.name || '').toLowerCase();
            return name.includes(homeTeam) || name.includes(awayTeam);
          });

          if (matchingEvent) {
            matchToEventMap.set(matchData.id, matchingEvent.event.id);
            
            if (matchingEvent.markets) {
              const winnerMarket = matchingEvent.markets.find((m: any) => 
                ['Match Odds', 'Winner', 'Match Betting', 'Winner 2025'].some(term => 
                  (m.marketName || '').toLowerCase().includes(term.toLowerCase())
                )
              );
              
              if (winnerMarket) {
                matchToMarketMap.set(matchData.id, winnerMarket.marketId);
                runnerMetadataMap.set(winnerMarket.marketId, winnerMarket.runners || []);
              }
            }
          }
        }
      } catch (err) {
        console.error("Discovery error for match:", matchData.id, err);
      }

      const matchRef = doc(db, 'matches', matchData.id);
      setDoc(matchRef, {
        ...matchData,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    }

    // 3. Phase 4: Fetch Live Market Books (POST listMarketBook)
    const allMarketIds = Array.from(matchToMarketMap.values());
    if (allMarketIds.length > 0) {
      const allBooks = await fetchMarketOdds(allMarketIds, '4');
      
      if (allBooks && Array.isArray(allBooks)) {
        for (const [matchId, marketId] of matchToMarketMap.entries()) {
          const marketBook = allBooks.find((b: any) => b.marketId === marketId);
          const runnersMeta = runnerMetadataMap.get(marketId) || [];
          
          if (marketBook && marketBook.runners) {
            const matchData = liveMatchesList.find(m => m.id === matchId);
            const homeTeam = (matchData?.teamA || '').toLowerCase();
            const awayTeam = (matchData?.teamB || '').toLowerCase();

            const homeRunner = marketBook.runners.find((r: any) => {
              const meta = runnersMeta.find(m => m.selectionId === r.selectionId);
              return (meta?.runnerName || '').toLowerCase().includes(homeTeam);
            }) || marketBook.runners[0];

            const awayRunner = marketBook.runners.find((r: any) => {
              const meta = runnersMeta.find(m => m.selectionId === r.selectionId);
              return (meta?.runnerName || '').toLowerCase().includes(awayTeam);
            }) || marketBook.runners[1];

            const marketOdds = {
              home: { 
                back: homeRunner?.ex?.availableToBack?.[0]?.price || 1.00,
                lay: homeRunner?.ex?.availableToLay?.[0]?.price || 0.00
              },
              away: { 
                back: awayRunner?.ex?.availableToBack?.[0]?.price || 1.00,
                lay: awayRunner?.ex?.availableToLay?.[0]?.price || 0.00
              }
            };

            const matchRef = doc(db, 'matches', matchId);
            setDoc(matchRef, {
              odds: marketOdds,
              marketId: marketId,
              lastUpdated: new Date().toISOString()
            }, { merge: true });

            const marketSubRef = doc(db, 'matches', matchId, 'markets', 'match_winner');
            setDoc(marketSubRef, {
              id: 'match_winner',
              type: 'match_winner',
              status: 'open',
              selections: [
                { 
                  id: 'home', 
                  name: matchData?.teamA || 'Home', 
                  odds: marketOdds.home.back, 
                  layOdds: marketOdds.home.lay || (marketOdds.home.back > 1 ? marketOdds.home.back + 0.02 : 0)
                },
                { 
                  id: 'away', 
                  name: matchData?.teamB || 'Away', 
                  odds: marketOdds.away.back, 
                  layOdds: marketOdds.away.lay || (marketOdds.away.back > 1 ? marketOdds.away.back + 0.02 : 0)
                }
              ]
            }, { merge: true });
          }
        }
      }
    }

    // 4. Fancy, Bookmaker and Premium Odds (GET)
    for (const [matchId, eventId] of matchToEventMap.entries()) {
      try {
        const fancyData = await fetchFancyOdds(eventId, '4');
        if (fancyData) {
          if (fancyData.bookmaker && fancyData.bookmaker.length > 0) {
            const bookmakerMarketRef = doc(db, 'matches', matchId, 'markets', 'bookmaker');
            setDoc(bookmakerMarketRef, {
              id: 'bookmaker',
              type: 'bookmaker',
              status: 'open',
              selections: fancyData.bookmaker.map((b: any) => ({
                id: b.selectionId?.toString() || b.runnerName,
                name: b.runnerName,
                odds: b.backPrice || 1.00,
                layOdds: b.layPrice || 0.00
              }))
            }, { merge: true });
          }

          if (fancyData.fancy && fancyData.fancy.length > 0) {
            const fancyMarketRef = doc(db, 'matches', matchId, 'markets', 'fancy');
            setDoc(fancyMarketRef, {
              id: 'fancy',
              type: 'fancy',
              status: 'open',
              selections: fancyData.fancy.map((f: any) => ({
                id: f.selectionId?.toString() || f.runnerName,
                name: f.runnerName,
                no: f.layPrice || 0,
                yes: f.backPrice || 0,
                status: f.gameStatus || 'active'
              }))
            }, { merge: true });
          }
        }

        // Premium Fancy Pulse
        const premiumFancy = await fetchPremiumFancy(eventId, '4');
        if (premiumFancy && Array.isArray(premiumFancy) && premiumFancy.length > 0) {
          const premiumRef = doc(db, 'matches', matchId, 'markets', 'premium_fancy');
          setDoc(premiumRef, {
            id: 'premium_fancy',
            type: 'premium_fancy',
            status: 'open',
            selections: premiumFancy.map((p: any) => ({
              id: p.selectionId?.toString() || p.runnerName,
              name: p.runnerName,
              no: p.layPrice || 0,
              yes: p.backPrice || 0,
              status: p.gameStatus || 'active'
            }))
          }, { merge: true });
        }
      } catch (err) {
        console.error("Professional micro-market fetch error for match:", matchId, err);
      }
    }

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
    console.error("Betfair Pulse Sync Error:", error);
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
