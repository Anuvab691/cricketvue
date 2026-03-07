'use server';

/**
 * @fileOverview Professional Service for Sportbex API.
 * Implements the full hierarchy: Competitions -> Events -> Markets -> Odds.
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
  betfairEventId?: string;
  betfairMarketId?: string;
  odds?: any;
  lastUpdated?: string;
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
const API_KEY = process.env.SPORTBEX_API_KEY || 'EXqcenzWl6ZPT7WnM9CwMf1ZWrnw7Cm9tkLXL7tD';

/**
 * Generic fetch helper with professional headers and no-cache.
 */
async function fetchWithHeaders(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any) {
  const url = `${SPORTBEX_BASE_URL}${endpoint.replace(/^\//, '')}`;
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
    if (body && method === 'POST') options.body = JSON.stringify(body);
    
    const response = await fetch(url, options);
    if (!response.ok) {
      console.error(`Sportbex API Error [${endpoint}]: ${response.status} ${response.statusText}`);
      return null;
    }
    return await response.json();
  } catch (error: any) {
    console.error(`Network Error [${endpoint}]:`, error.message);
    return null;
  }
}

// --- HIERARCHY LAYER 1: COMPETITIONS ---

export async function getCompetitions(sportId: string = '4'): Promise<ExternalSeries[]> {
  const json = await fetchWithHeaders(`betfair/${sportId}`);
  if (!json || !json.data) return [];
  return json.data.map((c: any) => ({
    id: c.competition?.id?.toString(),
    name: c.competition?.name || 'Unknown Series',
    category: 'Betfair Competition',
    gender: 'Men',
    type: 'Tournament',
    status: 'ACTIVE'
  }));
}

// --- HIERARCHY LAYER 2: EVENTS ---

export async function getEventsByCompetition(competitionId: string, sportId: string = '4') {
  const json = await fetchWithHeaders(`betfair/event/${sportId}/${competitionId}`);
  return json?.data || [];
}

// --- HIERARCHY LAYER 3 & 4: MARKETS & ODDS ---

/**
 * Professional implementation using listMarketBook POST protocol.
 */
export async function fetchMarketOdds(marketId: string) {
  const json = await fetchWithHeaders(`betfair/listMarketBook/4`, 'POST', {
    marketIds: [marketId]
  });
  
  const data = json?.data?.[0];
  if (!data) return null;

  // Normalized structure for Firestore
  return {
    marketId: data.marketId,
    status: data.status, // authority status for suspension
    inplay: !!data.inplay,
    totalMatched: data.totalMatched || 0,
    runners: (data.runners || []).map((runner: any) => ({
      selectionId: runner.selectionId,
      runnerName: runner.runnerName,
      status: runner.status,
      lastPriceTraded: runner.lastPriceTraded ?? null,
      back: (runner.ex?.availableToBack || []).slice(0, 3).map((b: any) => ({
        price: b.price || 0,
        size: b.size || 0
      })),
      lay: (runner.ex?.availableToLay || []).slice(0, 3).map((l: any) => ({
        price: l.price || 0,
        size: l.size || 0
      }))
    }))
  };
}

/**
 * Fetches high-frequency micro-market data (Bookmaker & Fancy).
 */
export async function fetchFancyOdds(eventId: string, sportId: string = '4') {
  const json = await fetchWithHeaders(`betfair/fancy-bookmaker-odds/${sportId}/${eventId}`);
  return json?.data || null;
}

/**
 * Fetches Professional Premium Fancy data.
 */
export async function fetchPremiumFancy(eventId: string) {
  const json = await fetchWithHeaders(`betfair/getPremium/4/${eventId}`);
  return json?.data || [];
}

/**
 * Fetches live scores for mapping.
 */
export async function fetchLiveScores(): Promise<ExternalMatch[]> {
  const json = await fetchWithHeaders(`live-score/match/live`);
  if (!json || !json.data) return [];
  const matchesArray = json.data.matches || (Array.isArray(json.data) ? json.data : []);
  return matchesArray.map((m: any) => transformLiveMatch(m));
}

function transformLiveMatch(match: any): ExternalMatch {
  const home = match.t1_name || match.home_team_name || 'TBA';
  const away = match.t2_name || match.away_team_name || 'TBA';
  const score = match.current_score || match.score || '';
  
  const statusRaw = (match.status || '').toUpperCase();
  const isCompleted = ['COMPLETED', 'FINISHED', 'RESULT'].includes(statusRaw);
  
  return {
    id: (match.id?.toString() || `${home}-${away}`).replace(/[^a-zA-Z0-9]/g, '-').toUpperCase(),
    name: match.name || `${home} v ${away}`,
    matchType: match.format || 'cricket',
    status: isCompleted ? 'finished' : (score || match.isLive ? 'live' : 'upcoming'),
    venue: match.ground || match.venue || 'Global Stadium',
    startTime: match.startDate || match.date || new Date().toISOString(),
    teamA: home,
    teamB: away,
    currentScore: score,
    statusText: match.result?.message || match.status_text || 'Scheduled'
  };
}
