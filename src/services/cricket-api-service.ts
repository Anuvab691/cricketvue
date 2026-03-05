'use server';

/**
 * @fileOverview High-Performance Server-Side Service for Sportbex API.
 * Optimized for the high-fidelity JSON schema provided for live matches and series.
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

export interface ExternalSeries {
  id: string;
  name: string;
  category: string;
  gender: string;
  type: string;
  status: string;
}

const SPORTBEX_BASE_URL = "https://trial-api.sportbex.com/api/";

/**
 * Core fetcher utilizing header-based authentication for Sportbex.
 */
async function fetchFromSportbex(endpoint: string) {
  const apiKey = process.env.SPORTBEX_API_KEY || 'EXqcenzWl6ZPT7WnM9CwMf1ZWrnw7Cm9tkLXL7tD';
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

    // Use the ID provided in the call to ensure the returned object maintains consistency
    return transformSportbexLiveMatch(json.data, matchId);
  } catch (e) {
    console.error(`Sportbex Detail Fetch Failed for ${matchId}:`, e);
    return null;
  }
}

/**
 * Fetches live series (tournaments) from the network.
 */
export async function fetchLiveSeries(): Promise<ExternalSeries[]> {
  try {
    const json = await fetchFromSportbex(`live-score/series?page=1&perPage=10&year=2026`);
    if (!json || !json.data || !json.data.series) return [];

    return json.data.series.map((s: any) => ({
      id: s.id?.toString(),
      name: s.name || 'Unknown Series',
      category: s.category || 'International',
      gender: s.gender || 'Men',
      type: s.type || 'Series',
      status: s.status || 'Active'
    }));
  } catch (e) {
    console.error("Sportbex Live Series Fetch Failed:", e);
    return [];
  }
}

/**
 * Transforms Sportbex Live Match schema into Terminal Match schema.
 * @param match The raw API response object.
 * @param originalId Optional ID to override the calculated ID (useful for detail fetches).
 */
function transformSportbexLiveMatch(match: any, originalId?: string): ExternalMatch {
  const teamsData = match.teams || {};
  const t1 = teamsData.t1 || {};
  const t2 = teamsData.t2 || {};

  const homeName = t1.name || match.home_team_name || match.teama || 'TBA';
  const awayName = t2.name || match.away_team_name || match.teamb || 'TBA';
  
  let scoreText = '';
  if (t1.score && t2.score) {
    scoreText = `${homeName}: ${t1.score} | ${awayName}: ${t2.score}`;
  } else if (t1.score || t2.score) {
    scoreText = `${t1.score || '0/0'} vs ${t2.score || '0/0'}`;
  } else if (match.score) {
    scoreText = match.score;
  }

  const isCompleted = match.status === 'COMPLETED' || match.status === 'finished';
  const isLive = match.isLive === true || match.status === 'LIVE' || match.status === 'In Play';

  // ID Resolution: Prefer originalId, then explicit ID fields, then generate from series/name
  const finalId = originalId || 
                 match.id?.toString() || 
                 match.matchId?.toString() || 
                 (match.seriesId && match.name ? `${match.seriesId}-${match.name}` : Math.random().toString(36).substr(2, 9));

  return {
    id: finalId,
    name: match.name || `${homeName} v ${awayName}`,
    matchType: match.format || 'cricket',
    status: isCompleted ? 'finished' : (isLive ? 'live' : 'upcoming'),
    venue: match.ground || match.venue || 'Global Stadium',
    date: match.startDate || match.date || new Date().toISOString(),
    series: match.seriesName || match.series || 'International Series',
    seriesId: match.seriesId?.toString(),
    teams: [homeName, awayName],
    score: scoreText,
    matchStarted: isLive || isCompleted,
    matchEnded: isCompleted,
    rawStatusText: match.result?.message || match.status_text || match.status || (isLive ? 'In Play' : 'Scheduled')
  };
}
