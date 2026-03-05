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
  startTime: string; 
  series?: string;
  seriesId?: string;
  teamA: string;
  teamB: string;
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
 * Betfair Discovery Phase 1: Fetches active competitions.
 */
export async function fetchBetfairCompetitions(sportId: string = '4') {
  const json = await fetchFromSportbex(`betfair/${sportId}`);
  return json?.data || [];
}

/**
 * Betfair Discovery Phase 2: Fetches events for a competition.
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
 * Betfair Pulse: Fetches the Market Book via POST.
 */
export async function fetchMarketBook(marketId: string, sportId: string = '4') {
  // STRICT adherence to the required curl format: {"marketIds": "market id"}
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
 * Fetches live series (tournaments).
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
 * Transformer: Maps Sportbex JSON to Terminal Match schema with robust team extraction.
 */
function transformSportbexLiveMatch(match: any, originalId?: string): ExternalMatch {
  const teamsData = match.teams || {};
  
  // Robust Team Name Extraction
  let homeName = 'TBA';
  let awayName = 'TBA';

  if (Array.isArray(match.teams) && match.teams.length >= 2) {
    homeName = match.teams[0]?.name || match.teams[0] || 'TBA';
    awayName = match.teams[1]?.name || match.teams[1] || 'TBA';
  } else if (teamsData.t1 || teamsData.t2) {
    homeName = teamsData.t1?.name || match.home_team_name || 'TBA';
    awayName = teamsData.t2?.name || match.away_team_name || 'TBA';
  } else if (match.teamA && match.teamB) {
    homeName = match.teamA;
    awayName = match.teamB;
  } else if (match.name && match.name.includes(' v ')) {
    const parts = match.name.split(' v ');
    homeName = parts[0];
    awayName = parts[1];
  }
  
  let scoreText = '';
  const t1 = teamsData.t1 || {};
  const t2 = teamsData.t2 || {};
  
  if (t1.score && t2.score) {
    scoreText = `${t1.score} v ${t2.score}`;
  } else if (t1.score || t2.score) {
    scoreText = t1.score || t2.score;
  } else if (match.score) {
    scoreText = match.score;
  }

  const statusRaw = (match.status || '').toUpperCase();
  const isCompleted = statusRaw === 'COMPLETED' || statusRaw === 'FINISHED';
  const isLive = match.isLive === true || statusRaw === 'LIVE' || statusRaw === 'IN PLAY' || !!t1.score || !!match.current_score;

  // Stable ID Generation (Sanitized for URLs)
  let finalId = originalId || match.id?.toString() || `${homeName}-${awayName}`;
  finalId = finalId.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toUpperCase();

  return {
    id: finalId,
    name: match.name || `${homeName} v ${awayName}`,
    matchType: match.format || 'cricket',
    status: isCompleted ? 'finished' : (isLive ? 'live' : 'upcoming'),
    venue: match.ground || match.venue || 'Global Stadium',
    date: match.startDate || match.date || new Date().toISOString(),
    startTime: match.startDate || match.date || new Date().toISOString(),
    series: match.seriesName || match.series || 'International Series',
    seriesId: match.seriesId?.toString(),
    teamA: homeName,
    teamB: awayName,
    teams: [homeName, awayName],
    score: scoreText,
    matchStarted: isLive || isCompleted,
    matchEnded: isCompleted,
    rawStatusText: match.result?.message || match.status_text || (isLive ? 'In Play' : 'Scheduled'),
    marketId: match.marketId || null
  };
}
