'use server';

/**
 * @fileOverview High-Performance Server-Side Service for Sportbex API.
 * Optimized for the high-fidelity JSON schema provided for live matches.
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
 * Updated to handle the nested teams object (t1/t2) and result messages.
 */
function transformSportbexLiveMatch(match: any): ExternalMatch {
  // Support for nested teams structure (t1, t2)
  const teamsData = match.teams || {};
  const t1 = teamsData.t1 || {};
  const t2 = teamsData.t2 || {};

  const homeName = t1.name || match.home_team_name || 'TBA';
  const awayName = t2.name || match.away_team_name || 'TBA';
  
  // Combine scores for display
  let scoreText = match.score || '';
  if (t1.score && t2.score) {
    scoreText = `${homeName}: ${t1.score} | ${awayName}: ${t2.score}`;
  } else if (t1.score || t2.score) {
    scoreText = `${t1.score || '0/0'} vs ${t2.score || '0/0'}`;
  }

  // Determine status
  const isCompleted = match.status === 'COMPLETED' || match.status === 'finished';
  const isLive = match.isLive === true || match.status === 'LIVE';

  return {
    id: match.id?.toString() || match.matchId?.toString() || match.seriesId + '-' + match.name,
    name: `${homeName} v ${awayName}`,
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
    rawStatusText: match.result?.message || match.status_text || match.status || 'In Play'
  };
}
