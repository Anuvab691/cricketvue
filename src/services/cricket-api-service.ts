'use server';

/**
 * @fileOverview High-Performance Server-Side Service for Sportbex API.
 * Optimized for real-time live match data using the live-score/match/live and detail endpoints.
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
 * Strictly adheres to the documented 'sportbex-api-key' header.
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
      console.warn("Sportbex Auth Error: Unauthorized access. Check header config.");
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
 * Fetches Cricket competitions (Tournaments) from Betfair endpoint.
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
 * Fetches high-level list of all live matches.
 */
export async function fetchLiveMatches(): Promise<ExternalMatch[]> {
  try {
    const json = await fetchFromSportbex(`live-score/match/live`);
    if (!json || !json.data) return [];

    // The live list provides the IDs we need for detailed sync
    return json.data.map((match: any) => transformSportbexLiveMatch(match));
  } catch (e) {
    console.error("Sportbex Live Score Fetch Failed:", e);
    return [];
  }
}

/**
 * Fetches deep-dive match data for a specific match ID.
 * Required for capturing detailed scores and ball-by-ball status.
 */
export async function fetchMatchDetail(matchId: string): Promise<ExternalMatch | null> {
  try {
    const json = await fetchFromSportbex(`live-score/match/${matchId}`);
    if (!json || !json.data) return null;

    return transformSportbexLiveMatch(json.data);
  } catch (e) {
    return null;
  }
}

/**
 * Transforms Sportbex Live Match schema into Terminal Match schema.
 * Handles both list and detail response formats.
 */
function transformSportbexLiveMatch(match: any): ExternalMatch {
  const homeName = match.home_team || match.home?.name || 'TBA';
  const awayName = match.away_team || match.away?.name || 'TBA';
  
  // Construct a score string if available
  let scoreText = undefined;
  const hScore = match.score_home ?? match.home_score;
  const aScore = match.score_away ?? match.away_score;
  
  if (hScore !== undefined && aScore !== undefined) {
    scoreText = `${hScore} - ${aScore}`;
  }

  return {
    id: match.id?.toString() || Math.random().toString(),
    name: `${homeName} v ${awayName}`,
    matchType: 'cricket',
    status: match.status === 'finished' ? 'finished' : 'live',
    venue: match.venue_name || match.venue || 'Global Stadium',
    date: match.match_date || match.date || new Date().toISOString(),
    series: match.competition_name || match.series_name || 'International Series',
    seriesId: (match.competition_id || match.series_id)?.toString(),
    teams: [homeName, awayName],
    score: scoreText,
    matchStarted: true,
    matchEnded: match.status === 'finished',
    rawStatusText: match.match_status_text || match.status_text || 'In Play'
  };
}
