
'use server';

/**
 * @fileOverview Professional Service for SportsGameOdds (SGO) v2 API.
 * Implements the v2 discovery flow: /v2/events -> odds.
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
  score?: string;
  currentScore?: string;
  statusText?: string;
  sgoEventId?: string;
  odds?: any;
  lastUpdated?: string;
}

const SGO_BASE_URL = "https://api.sportsgameodds.com/v2/";

/**
 * Converts American odds (e.g., -110, +150) to Decimal odds (e.g., 1.91, 2.50).
 */
function americanToDecimal(american: string | number): number {
  const num = typeof american === 'string' ? parseFloat(american) : american;
  if (isNaN(num)) return 2.0;

  if (num > 0) {
    return (num / 100) + 1;
  } else {
    return (100 / Math.abs(num)) + 1;
  }
}

/**
 * Robust fetch helper with SGO v2 auth.
 */
async function fetchSgo(endpoint: string, params: Record<string, string> = {}) {
  const apiKey = process.env.SGO_API_KEY;
  if (!apiKey) {
    throw new Error("SGO_API_KEY missing. Please configure your environment variables.");
  }

  const query = new URLSearchParams({ ...params, apiKey }).toString();
  const url = `${SGO_BASE_URL}${endpoint.replace(/^\//, '')}?${query}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`SGO v2 Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`SGO v2 Failure [${endpoint}]:`, error.message);
    return null;
  }
}

/**
 * Normalizes SGO status to CricketVue internal status.
 */
function normalizeSgoStatus(sgoEvent: any): 'upcoming' | 'live' | 'finished' {
  if (sgoEvent.status?.finalized || sgoEvent.status?.ended) return 'finished';
  if (sgoEvent.status?.started) return 'live';
  return 'upcoming';
}

/**
 * Fetches all active Cricket events from SGO v2.
 */
export async function fetchSgoCricketEvents(): Promise<ExternalMatch[]> {
  const json = await fetchSgo('events', {
    sportID: 'CRICKET',
    oddsAvailable: 'true',
    limit: '20'
  });

  if (!json || !json.data) return [];

  return json.data.map((event: any) => {
    const homeTeam = event.teams?.home?.name || event.teams?.home?.teamID || 'TBA';
    const awayTeam = event.teams?.away?.name || event.teams?.away?.teamID || 'TBA';
    
    // SGO v2 OddID format for Match Winner (Moneyline)
    const homeMlId = 'points-all-game-ml-home';
    const awayMlId = 'points-all-game-ml-away';

    // Get American odds from common bookmakers
    const homeAmOdds = event.odds?.[homeMlId]?.byBookmaker?.pinnacle?.odds || 
                       event.odds?.[homeMlId]?.byBookmaker?.draftkings?.odds || '100';
    const awayAmOdds = event.odds?.[awayMlId]?.byBookmaker?.pinnacle?.odds || 
                       event.odds?.[awayMlId]?.byBookmaker?.draftkings?.odds || '100';

    // Convert to Decimal for the Exchange UI
    const homeDec = americanToDecimal(homeAmOdds);
    const awayDec = americanToDecimal(awayAmOdds);

    return {
      id: event.eventID,
      sgoEventId: event.eventID,
      name: `${homeTeam} v ${awayTeam}`,
      teamA: homeTeam,
      teamB: awayTeam,
      startTime: event.status?.startsAt || new Date().toISOString(),
      status: normalizeSgoStatus(event),
      venue: event.venue || 'Global Stadium',
      series: event.leagueID || 'International',
      matchType: 'cricket',
      odds: {
        status: 'OPEN',
        home: { 
          back: [{ price: homeDec, size: 1000 }],
          lay: [{ price: homeDec + 0.02, size: 500 }] // Simulated lay spread
        },
        away: { 
          back: [{ price: awayDec, size: 1000 }],
          lay: [{ price: awayDec + 0.02, size: 500 }] // Simulated lay spread
        }
      },
      currentScore: event.score?.display || '0-0',
      statusText: event.status?.description || (event.status?.started ? 'In-Play' : 'Upcoming')
    };
  });
}

/**
 * Legacy wrapper for compatibility.
 */
export async function fetchLiveScores(): Promise<ExternalMatch[]> {
  return fetchSgoCricketEvents();
}

/**
 * Placeholder for Fancy/Premium odds.
 */
export async function fetchPremiumFancy(eventId: string) {
  return [];
}
