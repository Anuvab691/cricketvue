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

const SPORTBEX_BASE_URL = "https://trial-api.sportbex.com/api/";

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
 * Fetches high-level list of all live matches from the network pulse.
 */
export async function fetchLiveMatches(): Promise<ExternalMatch[]> {
  try {
    const json = await fetchFromSportbex(`live-score/match/live`);
    if (!json || !json.data) return [];

    // Sportbex sometimes returns data in a 'data' array or directly.
    const matchesArray = Array.isArray(json.data) ? json.data : (json.data?.matches || []);
    return matchesArray.map((match: any) => transformSportbexLiveMatch(match));
  } catch (e) {
    console.error("Sportbex Live Pulse Fetch Failed:", e);
    return [];
  }
}

/**
 * Fetches deep-dive match data for a specific match ID.
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
 * Robust mapping to handle multiple variations of field names.
 */
function transformSportbexLiveMatch(match: any): ExternalMatch {
  // Try to find team names in multiple common locations
  let homeName = match.home_team_name || match.home_team || match.teama || match.team_a || match.home_name || match.home?.name;
  let awayName = match.away_team_name || match.away_team || match.teamb || match.team_b || match.away_name || match.away?.name;

  // Fallback: If individual names are missing, try to parse the 'name' or 'eventName' field
  const fullName = match.name || match.eventName || match.event_name || '';
  if ((!homeName || homeName === 'TBA') && fullName.includes(' v ')) {
    const parts = fullName.split(' v ');
    homeName = parts[0]?.trim();
    awayName = parts[1]?.trim();
  } else if ((!homeName || homeName === 'TBA') && fullName.includes(' vs ')) {
    const parts = fullName.split(' vs ');
    homeName = parts[0]?.trim();
    awayName = parts[1]?.trim();
  }

  homeName = homeName || 'TBA';
  awayName = awayName || 'TBA';
  
  let scoreText = undefined;
  const hScore = match.score_home ?? match.home_score ?? match.home_runs;
  const aScore = match.score_away ?? match.away_score ?? match.away_runs;
  const hWickets = match.home_wickets;
  const aWickets = match.away_wickets;
  const hOvers = match.home_overs;
  const aOvers = match.away_overs;
  
  if (hScore !== undefined && aScore !== undefined) {
    scoreText = `${homeName} ${hScore}/${hWickets || 0} (${hOvers || '0.0'}) vs ${awayName} ${aScore}/${aWickets || 0} (${aOvers || '0.0'})`;
  } else if (match.current_score || match.score) {
    scoreText = match.current_score || match.score;
  }

  return {
    id: match.id?.toString() || Math.random().toString(),
    name: fullName || `${homeName} v ${awayName}`,
    matchType: 'cricket',
    status: match.status === 'finished' ? 'finished' : 'live',
    venue: match.venue_name || match.venue || 'Global Stadium',
    date: match.match_date || match.date || match.start_date || new Date().toISOString(),
    series: match.competition_name || match.series_name || match.league_name || 'International Series',
    seriesId: (match.competition_id || match.series_id || match.league_id)?.toString(),
    teams: [homeName, awayName],
    score: scoreText,
    matchStarted: true,
    matchEnded: match.status === 'finished',
    rawStatusText: match.match_status_text || match.status_text || match.status || 'In Play'
  };
}
