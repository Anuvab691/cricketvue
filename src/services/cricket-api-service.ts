'use server';

/**
 * @fileOverview High-Performance Server-Side Service for Sportbex API.
 * Optimized for real-time live match data using the live-score/match/live endpoint.
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
  score?: string;
  matchStarted: boolean;
  matchEnded: boolean;
  rawStatusText?: string;
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
 * Fetches Cricket competitions (Tournaments).
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
 * Fetches Live Matches using the dedicated live-score endpoint.
 */
export async function fetchLiveMatches(): Promise<ExternalMatch[]> {
  try {
    const json = await fetchFromSportbex(`live-score/match/live`);
    if (!json || !json.data) return [];

    return json.data.map((match: any) => transformSportbexLiveMatch(match));
  } catch (e) {
    console.error("Sportbex Live Score Fetch Failed:", e);
    return [];
  }
}

/**
 * Transforms Sportbex Live Match schema into Terminal Match schema.
 */
function transformSportbexLiveMatch(match: any): ExternalMatch {
  const homeName = match.home_team || 'TBA';
  const awayName = match.away_team || 'TBA';
  
  // Construct a score string if available
  let scoreText = undefined;
  if (match.score_home !== undefined && match.score_away !== undefined) {
    scoreText = `${match.score_home} - ${match.score_away}`;
  }

  return {
    id: match.id?.toString() || Math.random().toString(),
    name: `${homeName} v ${awayName}`,
    matchType: 'cricket',
    status: 'live',
    venue: match.venue_name || 'Global Stadium',
    date: match.match_date || new Date().toISOString(),
    series: match.competition_name || 'International Series',
    seriesId: match.competition_id?.toString(),
    teams: [homeName, awayName],
    score: scoreText,
    matchStarted: true,
    matchEnded: false,
    rawStatusText: match.match_status_text || 'In Play'
  };
}

/**
 * Simplified daily schedule fetch using live data.
 */
export async function fetchDailySchedule(dateString?: string): Promise<ExternalMatch[]> {
  const matches = await fetchLiveMatches();
  if (!dateString) return matches;
  return matches.filter(m => m.date.startsWith(dateString));
}
