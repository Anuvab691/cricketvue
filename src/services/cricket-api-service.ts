'use server';

/**
 * @fileOverview High-Performance Server-Side Service for Sportbex API.
 * Integrated with Betfair Exchange endpoints for live market data.
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
  betfairId?: string;
  marketId?: string;
  odds?: {
    home: { back: number; lay: number };
    away: { back: number; lay: number };
  };
}

export interface ExternalSeries {
  id: string;
  name: string;
  category: string;
  gender: string;
  type: string;
  status: string;
  resultText?: string;
}

const SPORTBEX_BASE_URL = "https://trial-api.sportbex.com/api/";
const API_KEY = process.env.SPORTBEX_API_KEY || 'EXqcenzWl6ZPT7WnM9CwMf1ZWrnw7Cm9tkLXL7tD';

/**
 * Core fetcher utilizing header-based authentication for Sportbex.
 */
async function fetchFromSportbex(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any) {
  const cleanEndpoint = endpoint.replace(/^\//, '');
  const url = `${SPORTBEX_BASE_URL}${cleanEndpoint}`;

  try {
    const options: RequestInit = {
      method,
      cache: 'no-store',
      headers: { 
        'sportbex-api-key': API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    if (!response.ok) return null;

    return await response.json();
  } catch (error: any) {
    console.error(`Sportbex Network Error [${endpoint}]:`, error.message);
    return null;
  }
}

/**
 * Betfair Discovery Phase 1: Fetches active Cricket competitions (Sport ID: 4).
 */
export async function fetchBetfairCompetitions() {
  const json = await fetchFromSportbex(`betfair/4`);
  return json?.data || [];
}

/**
 * Betfair Discovery Phase 2: Fetches events for a specific competition.
 */
export async function fetchBetfairEvents(competitionId: string) {
  const json = await fetchFromSportbex(`betfair/event/4/${competitionId}`);
  return json?.data || [];
}

/**
 * Betfair Discovery Phase 3: Fetches markets for a specific event.
 */
export async function fetchBetfairMarkets(eventId: string) {
  const json = await fetchFromSportbex(`betfair/markets/4/${eventId}`);
  return json?.data || [];
}

/**
 * Betfair Final Pulse: Fetches the market book (prices) for specific market IDs.
 */
export async function fetchMarketBook(marketId: string) {
  const json = await fetchFromSportbex(`betfair/listMarketBook/4`, 'POST', { marketIds: marketId });
  return json?.data?.[0] || null;
}

/**
 * Fetches high-level list of all live matches from the network pulse.
 */
export async function fetchLiveMatches(): Promise<ExternalMatch[]> {
  try {
    const json = await fetchFromSportbex(`live-score/match/live`);
    if (!json || !json.data) return [];
    // Handle both array and object response variations
    const matchesArray = Array.isArray(json.data) ? json.data : (json.data?.matches || []);
    return matchesArray.map((match: any) => transformSportbexLiveMatch(match));
  } catch (e) {
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
    return transformSportbexLiveMatch(json.data, matchId);
  } catch (e) {
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
      status: s.status || 'Active',
      resultText: s.status_text || s.result?.message || null
    }));
  } catch (e) {
    return [];
  }
}

/**
 * Transforms Sportbex Live Match schema into Terminal Match schema.
 * Now handles the t1/t2 structure provided in your JSON example.
 */
function transformSportbexLiveMatch(match: any, originalId?: string): ExternalMatch {
  const teamsData = match.teams || {};
  const t1 = teamsData.t1 || {};
  const t2 = teamsData.t2 || {};

  const homeName = t1.name || match.home_team_name || match.teamA || 'TBA';
  const awayName = t2.name || match.away_team_name || match.teamB || 'TBA';
  
  let scoreText = '';
  if (t1.score && t2.score) {
    scoreText = `${homeName}: ${t1.score} | ${awayName}: ${t2.score}`;
  } else if (match.score) {
    scoreText = match.score;
  }

  const isCompleted = match.status === 'COMPLETED' || match.status === 'finished';
  const isLive = match.isLive === true || match.status === 'LIVE' || match.status === 'In Play';

  // Sanitize IDs: Decode URI and replace spaces with hyphens for clean Firestore Doc IDs and URLs
  let finalId = originalId || match.id?.toString();
  if (finalId) {
    finalId = decodeURIComponent(finalId).replace(/\s+/g, '-');
  }

  return {
    id: finalId || Math.random().toString(36).substr(2, 9),
    name: match.name || `${homeName} v ${awayName}`,
    matchType: match.format || 'cricket',
    status: isCompleted ? 'finished' : (isLive ? 'live' : 'upcoming'),
    venue: match.ground || match.venue || 'Global Stadium',
    date: match.startDate || match.date || new Date().toISOString(),
    series: match.seriesName || 'International Series',
    seriesId: match.seriesId?.toString(),
    teams: [homeName, awayName],
    score: scoreText,
    matchStarted: isLive || isCompleted,
    matchEnded: isCompleted,
    rawStatusText: match.result?.message || match.status_text || (isLive ? 'In Play' : 'Scheduled')
  };
}
