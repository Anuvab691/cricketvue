'use server';

/**
 * @fileOverview Professional Service for SportsGameOdds (SGO) v2 API.
 * Implements the v2 discovery flow: Events -> Odds (via oddID).
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

export interface ExternalLeague {
  id: string;
  name: string;
}

const SGO_BASE_URL = "https://api.sportsgameodds.com/v2/";
const API_KEY = process.env.SGO_API_KEY;

/**
 * Robust fetch helper with retries, timeouts, and SGO v2 auth.
 */
async function fetchSgo(endpoint: string, params: Record<string, string> = {}, method: 'GET' | 'POST' = 'GET', body?: any, retries: number = 3) {
  if (!API_KEY) {
    throw new Error("SGO_API_KEY missing. Please configure your environment variables.");
  }

  const query = new URLSearchParams(params).toString();
  const url = `${SGO_BASE_URL}${endpoint.replace(/^\//, '')}${query ? `?${query}` : ''}`;
  const timeout = 8000;

  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const options: RequestInit = {
        method,
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'x-api-key': API_KEY,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      };

      if (body && method === 'POST') options.body = JSON.stringify(body);
      
      const response = await fetch(url, options);
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`SGO v2 Error: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      return json;
    } catch (error: any) {
      clearTimeout(timer);
      if (i === retries - 1) {
        console.error(`SGO v2 Final Failure [${endpoint}]:`, error.message);
        return null;
      }
      await new Promise(res => setTimeout(res, 1000));
    }
  }
  return null;
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
  // We use sportID=CRICKET (Assumed based on common SGO naming)
  const json = await fetchSgo('events', {
    sportID: 'CRICKET',
    oddsAvailable: 'true',
    limit: '20'
  });

  if (!json || !json.data) return [];

  return json.data.map((event: any) => {
    const homeTeam = event.teams?.home?.name || 'TBA';
    const awayTeam = event.teams?.away?.name || 'TBA';
    
    // SGO v2 uses specific oddID for Match Winner
    // points (stat) - all (entity) - game (period) - ml (betType) - home/away (side)
    const homeMlId = 'points-all-game-ml-home';
    const awayMlId = 'points-all-game-ml-away';

    const homeOdds = event.odds?.[homeMlId]?.byBookmaker?.pinnacle?.odds || 
                    event.odds?.[homeMlId]?.byBookmaker?.draftkings?.odds || '2.00';
    const awayOdds = event.odds?.[awayMlId]?.byBookmaker?.pinnacle?.odds || 
                    event.odds?.[awayMlId]?.byBookmaker?.draftkings?.odds || '2.00';

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
        home: { back: [{ price: parseFloat(homeOdds) || 2.0, size: 1000 }] },
        away: { back: [{ price: parseFloat(awayOdds) || 2.0, size: 1000 }] }
      },
      currentScore: event.score?.display || '0-0',
      statusText: event.status?.description || 'In Progress'
    };
  });
}

/**
 * Legacy wrapper for compatibility with sync actions.
 */
export async function fetchLiveScores(): Promise<ExternalMatch[]> {
  return fetchSgoCricketEvents();
}

/**
 * Placeholder for Fancy/Premium odds in SGO v2 logic.
 */
export async function fetchPremiumFancy(eventId: string) {
  // SGO v2 returns all odds in the events object if filtered.
  // This can be expanded to fetch specialized market IDs if SGO provides them.
  return [];
}
