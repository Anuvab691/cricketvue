'use server';

/**
 * @fileOverview High-Performance Server-Side Service for Sportbex Betfair API.
 * Optimized for professional exchange data flow: Competitions -> Events -> Odds.
 */

export interface ExternalMatch {
  id: string;
  name: string;
  matchType: string;
  status: string;
  venue: string;
  date: string;
  series?: string;
  seriesId?: string;
  teams: string[];
  score?: Array<{
    inning: string;
    r: string;
  }>;
  matchStarted: boolean;
  matchEnded: boolean;
  rawStatusText?: string;
  probabilities?: {
    home: number;
    away: number;
    draw?: number;
  };
}

export interface ExternalTournament {
  id: string;
  name: string;
  category: string;
  gender: string;
  type: string;
}

const SPORTBEX_BASE_URL = "https://trial-api.sportbex.com/api/";
const CRICKET_SPORT_ID = "4";

/**
 * Core fetcher utilizing header-based authentication for Sportbex.
 */
async function fetchFromSportbex(endpoint: string) {
  const apiKey = process.env.SPORTBEX_API_KEY;
  if (!apiKey) {
    console.warn("Sportbex API Key Missing: Ensure SPORTBEX_API_KEY is in .env");
    return null;
  }

  const cleanEndpoint = endpoint.replace(/^\//, '');
  const url = `${SPORTBEX_BASE_URL}${cleanEndpoint}`;

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 
        'sportbex-api-key': apiKey,
        'Accept': 'application/json' 
      }
    });
    
    if (response.status === 401 || response.status === 403) {
      console.warn("Sportbex Auth Error: Unauthorized access.");
      return null;
    }

    if (!response.ok) return null;

    return await response.json();
  } catch (error: any) {
    console.error(`Sportbex Network Error [${endpoint}]:`, error.message);
    return null;
  }
}

/**
 * Fetches Cricket competitions (Step 1 of Sportbex flow).
 */
export async function fetchCompetitions(): Promise<ExternalTournament[]> {
  try {
    const json = await fetchFromSportbex(`betfair/competitions/${CRICKET_SPORT_ID}`);
    if (!json || !json.data) return [];
    
    return json.data.map((c: any) => ({
      id: c.id?.toString(),
      name: c.name || 'Unknown Series',
      category: 'Betfair',
      gender: 'men',
      type: 'league'
    }));
  } catch (e) {
    return [];
  }
}

/**
 * Fetches Live Matches by crawling competitions (Step 2 of Sportbex flow).
 */
export async function fetchLiveMatches(): Promise<ExternalMatch[]> {
  try {
    // 1. Get Competitions
    const competitionsJson = await fetchFromSportbex(`betfair/competitions/${CRICKET_SPORT_ID}`);
    if (!competitionsJson || !competitionsJson.data) return [];

    let allMatches: ExternalMatch[] = [];

    // 2. Fetch events for each competition (Sequential with small delay for rate limits)
    for (const comp of competitionsJson.data) {
      if (!comp.id) continue;
      
      const eventsJson = await fetchFromSportbex(`betfair/event/${CRICKET_SPORT_ID}/${comp.id}`);
      
      if (eventsJson && eventsJson.data) {
        const transformed = eventsJson.data.map((event: any) => transformSportbexMatch(event, comp.name));
        allMatches.push(...transformed);
      }
      
      // Delay 100ms to be safe with trial keys
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return allMatches;
  } catch (e) {
    console.error("Sportbex Live Fetch Failed:", e);
    return [];
  }
}

/**
 * Not directly available in Betfair endpoints, but we can simulate via date filtering
 * on active events or competition crawls.
 */
export async function fetchDailySchedule(dateString?: string): Promise<ExternalMatch[]> {
  // For Sportbex Betfair flow, we typically get all active events via competition crawl.
  // We filter by date if provided.
  const matches = await fetchLiveMatches();
  if (!dateString) return matches;

  return matches.filter(m => m.date.startsWith(dateString));
}

/**
 * Transforms Betfair Event schema into Exchange Match schema.
 * Sportbex Betfair events use 'eventName' and 'marketId'.
 */
function transformSportbexMatch(event: any, competitionName: string): ExternalMatch {
  const eventName = event.eventName || 'TBA v TBA';
  // Split "Team A v Team B" or "Team A vs Team B"
  const teams = eventName.split(/ v | vs /i).map((t: string) => t.trim());
  const homeName = teams[0] || 'TBA';
  const awayName = teams[1] || 'TBA';

  return {
    id: event.id?.toString() || event.marketId || Math.random().toString(),
    name: eventName,
    matchType: 'cricket',
    status: 'live',
    venue: event.venue || 'Global Stadium',
    date: event.openDate || new Date().toISOString(),
    series: competitionName || 'International Series',
    seriesId: event.competitionId?.toString(),
    teams: [homeName, awayName],
    score: undefined, // Betfair Basic event endpoint usually doesn't provide live scores
    matchStarted: true,
    matchEnded: false,
    rawStatusText: 'In Play',
    probabilities: {
      home: 50,
      away: 50
    }
  };
}
