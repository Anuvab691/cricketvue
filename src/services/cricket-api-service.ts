'use server';

/**
 * @fileOverview Professional Service for SportsGameOdds (SGO) v2 API.
 * This service implements the SGO v2 protocol for fetching live cricket events, scores, and odds.
 */

export interface ExternalMatch {
  id: string;
  name: string;
  matchType: string;
  status: 'upcoming' | 'live' | 'finished';
  venue: string;
  startTime: string;
  series?: string;
  seriesId?: string;
  teamA: string;
  teamB: string;
  currentScore?: string;
  statusText?: string;
  odds?: any;
  lastUpdated?: string;
}

const SGO_BASE_URL = "https://api.sportsgameodds.com/v2/";

/**
 * Converts American odds (e.g., -110, +150) to Decimal odds (e.g., 1.91, 2.50).
 * SGO v2 provides American odds, but the terminal uses Decimal format.
 */
function americanToDecimal(american: string | number | undefined): number {
  if (american === undefined) return 2.0;
  const num = typeof american === 'string' ? parseFloat(american) : american;
  if (isNaN(num)) return 2.0;

  if (num > 0) {
    return (num / 100) + 1;
  } else {
    return (100 / Math.abs(num)) + 1;
  }
}

/**
 * Robust fetch helper with SGO v2 authentication.
 */
async function fetchSgo(endpoint: string, params: Record<string, string> = {}) {
  const apiKey = process.env.SGO_API_KEY;
  if (!apiKey) {
    console.error("SGO_API_KEY is missing from environment variables.");
    return null;
  }

  const queryParams = new URLSearchParams({ ...params, apiKey });
  const url = `${SGO_BASE_URL}${endpoint.replace(/^\//, '')}?${queryParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      console.error(`SGO v2 Fetch Error: ${response.status} at ${endpoint}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`SGO v2 Network Failure [${endpoint}]:`, error);
    return null;
  }
}

/**
 * Normalizes SGO event status to CricketVue internal status.
 */
function normalizeSgoStatus(event: any): 'upcoming' | 'live' | 'finished' {
  if (event.status?.finalized || event.status?.ended) return 'finished';
  if (event.status?.started) return 'live';
  return 'upcoming';
}

/**
 * Fetches all active Cricket events from SGO v2 with live odds.
 */
export async function fetchSgoCricketEvents(): Promise<ExternalMatch[]> {
  const json = await fetchSgo('events', {
    sportID: 'CRICKET',
    oddsAvailable: 'true',
    limit: '20'
  });

  if (!json || !json.data) {
    console.warn("No data returned from SGO v2 events endpoint.");
    return [];
  }

  return json.data.map((event: any) => {
    const homeTeam = event.teams?.home?.name || event.teams?.home?.teamID || 'TBA';
    const awayTeam = event.teams?.away?.name || event.teams?.away?.teamID || 'TBA';
    
    // SGO v2 Moneyline OddID patterns
    // Format: {statID}-{statEntityID}-{periodID}-{betTypeID}-{sideID}
    const homeMLPath = 'points-home-game-ml-home';
    const awayMLPath = 'points-away-game-ml-away';
    const fallbackHomeMLPath = 'points-all-game-ml-home';
    const fallbackAwayMLPath = 'points-all-game-ml-away';

    const getPrice = (oddID: string, altID: string) => {
      const odd = event.odds?.[oddID] || event.odds?.[altID];
      if (!odd) return undefined;
      
      // Prefer Pinnacle for professional sharp lines, fallback to DraftKings or first available
      const bookmakers = odd.byBookmaker || {};
      const bookie = bookmakers.pinnacle || bookmakers.draftkings || Object.values(bookmakers)[0];
      return (bookie as any)?.odds;
    };

    const homeAmOdds = getPrice(homeMLPath, fallbackHomeMLPath);
    const awayAmOdds = getPrice(awayMLPath, fallbackAwayMLPath);

    const homeDec = americanToDecimal(homeAmOdds);
    const awayDec = americanToDecimal(awayAmOdds);

    return {
      id: event.eventID,
      name: `${homeTeam} v ${awayTeam}`,
      teamA: homeTeam,
      teamB: awayTeam,
      startTime: event.status?.startsAt || new Date().toISOString(),
      status: normalizeSgoStatus(event),
      venue: event.venue || 'Global Stadium',
      series: event.leagueID || 'International Series',
      matchType: 'cricket',
      odds: {
        status: 'OPEN',
        home: { 
          back: [{ price: homeDec, size: 1000 }],
          lay: [{ price: Number((homeDec + 0.05).toFixed(2)), size: 500 }]
        },
        away: { 
          back: [{ price: awayDec, size: 1000 }],
          lay: [{ price: Number((awayDec + 0.05).toFixed(2)), size: 500 }]
        }
      },
      currentScore: event.status?.score?.display || '0-0',
      statusText: event.status?.description || (event.status?.started ? 'In-Play' : 'Upcoming')
    };
  });
}

/**
 * Legacy compatibility wrappers.
 */
export async function fetchLiveScores(): Promise<ExternalMatch[]> {
  return fetchSgoCricketEvents();
}

export async function fetchPremiumFancy(eventId: string): Promise<any[]> {
  // SGO v2 provides detailed props in the main events endpoint.
  // For now, return empty to signify high-liquidity micro-markets suspended.
  return [];
}
