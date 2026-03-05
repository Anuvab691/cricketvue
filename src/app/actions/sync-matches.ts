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
 * Professional Sync Engine: Implements the full Betfair Discovery Chain.
 * discovery: competitions -> events -> marketIds -> listMarketBook (POST)
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    // 1. Sync Series
    const seriesList = await fetchLiveSeries();
    for (const series of seriesList) {
      if (!series.id) continue;
      setDoc(doc(db, 'tournaments', series.id), {
        ...series,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    }

    // 2. Fetch Live Sportbex Matches
    const liveMatchesList = await fetchLiveMatches();
    const activeMatchIds = new Set<string>();

    // 3. Phase 1 & 2: Betfair Discovery (Sport '4' = Cricket)
    const competitions = await fetchBetfairCompetitions('4'); 
    const matchToBetfairMap = new Map<string, { eventId: string; marketId: string; runners: any[] }>();

    for (const comp of (competitions || [])) {
      const competitionId = comp.competition?.id;
      if (!competitionId) continue;
      
      const events = await fetchBetfairEvents(competitionId, '4');
      if (!events || !Array.isArray(events)) continue;

      for (const betfairEvent of events) {
        const e = betfairEvent.event;
        if (!e || !e.name) continue;

        // Link Sportbex match to Betfair Event
        const matchedMatch = liveMatchesList.find(m => {
          const mName = (m.name || '').toLowerCase();
          const eName = (e.name || '').toLowerCase();
          const teamA = (m.teamA || '').toLowerCase();
          const teamB = (m.teamB || '').toLowerCase();
          return eName.includes(mName) || mName.includes(eName) || (eName.includes(teamA) && eName.includes(teamB));
        });

        if (matchedMatch) {
          // SELECT MARKET: Strengthened selection logic
          const targetMarketNames = ['match odds', 'match winner', 'winner'];
          let market = betfairEvent.markets?.find((m: any) => 
            targetMarketNames.some(name => (m.marketName || '').toLowerCase().includes(name))
          );

          if (!market && betfairEvent.markets?.length > 0) {
            console.log(`Preferred market not found for ${e.name}. Markets available:`, 
              betfairEvent.markets.map((m: any) => m.marketName).join(', '));
            market = betfairEvent.markets[0];
          }

          if (market) {
            matchToBetfairMap.set(matchedMatch.id, {
              eventId: e.id,
              marketId: market.marketId,
              runners: market.runners || []
            });
          }
        }
      }
    }

    // 5. Update Matches & Fetch Micro-Markets
    for (const matchSummary of liveMatchesList) {
      const matchData = await fetchMatchDetail(matchSummary.id) || matchSummary;
      activeMatchIds.add(matchData.id);

      const betfairInfo = matchToBetfairMap.get(matchData.id);
      let professionalOdds = null;

      if (betfairInfo) {
        // Phase 3: High-Frequency Pulse (listMarketBook POST)
        const marketBook = await fetchMarketOdds(betfairInfo.marketId);

        if (marketBook && marketBook.runners && marketBook.runners.length >= 2) {
          // Professional Runner Mapping
          const runner1 = marketBook.runners[0];
          const runner2 = marketBook.runners[1];

          professionalOdds = {
            status: marketBook.status,
            home: { 
              back: runner1.back?.[0]?.price || 1.00,
              lay: runner1.lay?.[0]?.price || 0.00,
              lastPrice: runner1.lastPriceTraded
            },
            away: { 
              back: runner2.back?.[0]?.price || 1.00,
              lay: runner2.lay?.[0]?.price || 0.00,
              lastPrice: runner2.lastPriceTraded
            }
          };

          // Update match_winner sub-collection with normalized data
          const marketSubRef = doc(db, 'matches', matchData.id, 'markets', 'match_winner');
          setDoc(marketSubRef, {
            id: 'match_winner',
            type: 'match_winner',
            status: marketBook.status,
            selections: marketBook.runners.map((r, idx) => ({
              id: r.selectionId.toString(),
              name: idx === 0 ? matchData.teamA : (idx === 1 ? matchData.teamB : r.runnerName || 'Draw'),
              odds: r.back?.[0]?.price || 1.00,
              layOdds: r.lay?.[0]?.price || 0.00,
              lastPrice: r.lastPriceTraded,
              backLiquidity: r.back || [],
              layLiquidity: r.lay || []
            }))
          }, { merge: true });
        }

        // Fancy & Bookmaker pulse
        const fancyData = await fetchFancyOdds(betfairInfo.eventId, '4');
        if (fancyData) {
          if (fancyData.bookmaker && fancyData.bookmaker.length > 0) {
            setDoc(doc(db, 'matches', matchData.id, 'markets', 'bookmaker'), {
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
            setDoc(doc(db, 'matches', matchData.id, 'markets', 'fancy'), {
              id: 'fancy',
              type: 'fancy',
              status: 'open',
              selections: fancyData.fancy.map((f: any) => ({
                id: f.selectionId?.toString() || f.runnerName,
                name: f.runnerName,
                no: f.layPrice || 0,
                yes: f.backPrice || 0
              }))
            }, { merge: true });
          }
        }

        // Premium Fancy pulse
        const premiumData = await fetchPremiumFancy(betfairInfo.eventId);
        if (premiumData && Array.isArray(premiumData)) {
          setDoc(doc(db, 'matches', matchData.id, 'markets', 'premium_fancy'), {
            id: 'premium_fancy',
            type: 'premium_fancy',
            status: 'open',
            selections: premiumData.map((p: any) => ({
              id: p.selectionId?.toString() || p.runnerName,
              name: p.runnerName,
              no: p.layPrice || 0,
              yes: p.backPrice || 0,
              backPrice: p.backPrice,
              layPrice: p.layPrice
            }))
          }, { merge: true });
        }
      }

      const matchRef = doc(db, 'matches', matchData.id);
      setDoc(matchRef, {
        ...matchData,
        betfairEventId: betfairInfo?.eventId || null,
        betfairMarketId: betfairInfo?.marketId || null,
        odds: professionalOdds,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    }

    // 6. Pruning
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

    return { success: true, count: liveMatchesList.length, pruned };
  } catch (error: any) {
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
