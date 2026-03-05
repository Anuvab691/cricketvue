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
 * Precision Sync Engine: Implements the full Betfair Discovery Chain.
 * Uses Step-by-Step Discovery: competitions -> events -> marketIds -> listMarketBook (POST)
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

    // 2. Fetch Live Sportbex Matches (Base for the Terminal)
    const liveMatchesList = await fetchLiveMatches();
    const activeMatchIds = new Set<string>();

    // 3. Phase 1 & 2: Betfair Discovery Chain (Sport '4' = Cricket)
    const competitions = await fetchBetfairCompetitions('4'); 
    const matchToBetfairMap = new Map<string, { eventId: string; marketId: string; runners: any[] }>();

    // We crawl competitions to find events and link them to live matches
    for (const comp of (competitions || [])) {
      const competitionId = comp.competition?.id;
      if (!competitionId) continue;
      
      const events = await fetchBetfairEvents(competitionId, '4');
      if (!events || !Array.isArray(events)) continue;

      for (const betfairEvent of events) {
        const e = betfairEvent.event;
        if (!e || !e.name) continue;

        // Find the matching live match from Sportbex by name comparison
        const matchedMatch = liveMatchesList.find(m => {
          const mName = (m.name || '').toLowerCase();
          const eName = (e.name || '').toLowerCase();
          const teamA = (m.teamA || '').toLowerCase();
          const teamB = (m.teamB || '').toLowerCase();
          
          return eName.includes(mName) || mName.includes(eName) || (eName.includes(teamA) && eName.includes(teamB));
        });

        if (matchedMatch) {
          const market = betfairEvent.markets?.find((m: any) => 
            ['Match Odds', 'Winner', 'Match Betting'].some(term => 
              (m.marketName || '').toLowerCase().includes(term.toLowerCase())
            )
          );

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

    // 4. Phase 3 & 4: Professional Odds Pulse (listMarketBook POST)
    // We send a comma-separated string of marketIds as per specific protocol.
    const marketIdsArray = Array.from(matchToBetfairMap.values()).map(b => b.marketId);
    const marketIdsString = marketIdsArray.join(', ');
    let marketBooks: any[] = [];
    if (marketIdsString) {
      marketBooks = await fetchMarketOdds(marketIdsString, '4') || [];
    }

    // 5. Update Matches and Fetch Micro-Markets
    for (const matchSummary of liveMatchesList) {
      const matchData = await fetchMatchDetail(matchSummary.id) || matchSummary;
      activeMatchIds.add(matchData.id);

      const betfairInfo = matchToBetfairMap.get(matchData.id);
      let professionalOdds = null;

      if (betfairInfo) {
        const book = marketBooks.find(b => b.marketId === betfairInfo.marketId);
        if (book && book.runners) {
          const homeTeam = (matchData.teamA || '').toLowerCase();
          const awayTeam = (matchData.teamB || '').toLowerCase();

          const homeRunner = book.runners.find((r: any) => {
            const meta = betfairInfo.runners.find(m => m.selectionId === r.selectionId);
            return (meta?.runnerName || '').toLowerCase().includes(homeTeam);
          }) || book.runners[0];

          const awayRunner = book.runners.find((r: any) => {
            const meta = betfairInfo.runners.find(m => m.selectionId === r.selectionId);
            return (meta?.runnerName || '').toLowerCase().includes(awayTeam);
          }) || book.runners[1];

          professionalOdds = {
            home: { 
              back: homeRunner?.ex?.availableToBack?.[0]?.price || 1.00,
              lay: homeRunner?.ex?.availableToLay?.[0]?.price || 0.00
            },
            away: { 
              back: awayRunner?.ex?.availableToBack?.[0]?.price || 1.00,
              lay: awayRunner?.ex?.availableToLay?.[0]?.price || 0.00
            }
          };

          const marketSubRef = doc(db, 'matches', matchData.id, 'markets', 'match_winner');
          setDoc(marketSubRef, {
            id: 'match_winner',
            type: 'match_winner',
            status: 'open',
            selections: [
              { id: 'home', name: matchData.teamA, odds: professionalOdds.home.back, layOdds: professionalOdds.home.lay },
              { id: 'away', name: matchData.teamB, odds: professionalOdds.away.back, layOdds: professionalOdds.away.lay }
            ]
          }, { merge: true });
        }

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
        odds: professionalOdds,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    }

    // 6. "No More, No Less" Pruning
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
    console.error("Discovery Chain Pulse Error:", error);
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
