'use server';

/**
 * @fileOverview High-Performance Server-Side Service for Sportbex API.
 * Integrated with Betfair Exchange endpoints for live market discovery.
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
const API_KEY = 'EXqcenzWl6ZPT7WnM9CwMf1ZWrnw7Cm9tkLXL7tD';

/**
 * Core fetcher for Sportbex API with header-based authentication.
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

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error: any) {
    console.error(`Sportbex Error [${endpoint}]:`, error.message);
    return null;
  }
}

/**
 * Betfair Discovery Phase 1: Fetches active competitions for a sport.
 */
export async function fetchBetfairCompetitions(sportId: string = '4') {
  const json = await fetchFromSportbex(`betfair/${sportId}`);
  return json?.data || [];
}

/**
 * Betfair Discovery Phase 2: Fetches events for a specific competition.
 */
export async function fetchBetfairEvents(competitionId: string, sportId: string = '4') {
  const json = await fetchFromSportbex(`betfair/event/${sportId}/${competitionId}`);
  return json?.data || [];
}

/**
 * Betfair Discovery Phase 3: Fetches available markets for an event.
 */
export async function fetchBetfairMarkets(eventId: string, sportId: string = '4') {
  const json = await fetchFromSportbex(`betfair/markets/${sportId}/${eventId}`);
  return json?.data || [];
}

/**
 * Betfair Pulse: Fetches the Market Book (odds/prices) via POST.
 */
export async function fetchMarketBook(marketId: string, sportId: string = '4') {
  const json = await fetchFromSportbex(`betfair/listMarketBook/${sportId}`, 'POST', { 
    marketIds: marketId 
  });
  return json?.data?.[0] || null;
}

/**
 * Fetches all live matches currently active on the network.
 */
export async function fetchLiveMatches(): Promise<ExternalMatch[]> {
  try {
    const json = await fetchFromSportbex(`live-score/match/live`);
    if (!json || !json.data) return [];
    
    const matchesArray = json.data.matches || (Array.isArray(json.data) ? json.data : []);
    return matchesArray.map((match: any) => transformSportbexLiveMatch(match));
  } catch (e) {
    return [];
  }
}

/**
 * Fetches deep detail for a specific match ID.
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
 * Fetches live series (tournaments) for the specified year using the requested endpoint.
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
 * Transformer: Maps Sportbex JSON (t1/t2 structure) to Terminal Match schema.
 */
function transformSportbexLiveMatch(match: any, originalId?: string): ExternalMatch {
  const teamsData = match.teams || {};
  const t1 = teamsData.t1 || {};
  const t2 = teamsData.t2 || {};

  const homeName = t1.name || match.home_team_name || match.teamA || 'TBA';
  const awayName = t2.name || match.away_team_name || match.teamB || 'TBA';
  
  let scoreText = '';
  if (t1.score && t2.score) {
    scoreText = `${t1.score} v ${t2.score}`;
  } else if (t1.score || t2.score) {
    scoreText = t1.score || t2.score;
  } else if (match.score) {
    scoreText = match.score;
  }

  const status = match.status || '';
  const isCompleted = status === 'COMPLETED' || status === 'finished';
  const isLive = match.isLive === true || status === 'LIVE' || status === 'In Play' || !!t1.score;

  // Preserve ID strictly to avoid mismatch.
  let finalId = originalId || match.id?.toString() || Math.random().toString(36).substr(2, 9);
  
  // Sanitization: Remove spaces from IDs for URL stability
  finalId = finalId.replace(/\s+/g, '-').toUpperCase();

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
    rawStatusText: match.result?.message || match.status_text || (isLive ? 'In Play' : 'Scheduled')
  };
}
