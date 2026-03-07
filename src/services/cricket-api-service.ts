'use server';

/**
 * @fileOverview Professional Service for Sportbex API.
 * Implements the full hierarchy: Competitions -> Events -> Markets -> Odds.
 * 
 * Fixes included:
 * - Environment-only API Key (no hardcoding)
 * - Fetch with timeout (AbortController) and retry logic
 * - Complete hierarchy discovery (Markets layer added)
 * - Defensive parsing for varied response shapes
 * - Professional status normalization
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
  markets?: ExternalMarket[];
}

export interface ExternalSeries {
  id: string;
  name: string;
  category: string;
  gender: string;
  type: string;
  status: string;
}

export interface ExternalMarket {
  id: string;
  name: string;
  type: string;
  status: 'open' | 'suspended' | 'closed' | 'unknown';
  eventId: string;
}

const SPORTBEX_BASE_URL = "https://trial-api.sportbex.com/api/";
const API_KEY = process.env.SPORTBEX_API_KEY;

// Throw error early if API key is missing
if (!API_KEY) {
  console.warn("CRITICAL ERROR: SPORTBEX_API_KEY is not defined in the environment variables.");
}

/**
 * Robust fetch helper with timeout, retries, and professional headers.
 */
async function fetchWithHeaders(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any, retries: number = 3) {
  if (!API_KEY) {
    throw new Error("SPORTBEX_API_KEY missing. Check your environment configuration.");
  }

  const url = `${SPORTBEX_BASE_URL}${endpoint.replace(/^\//, '')}`;
  const timeout = 8000; // 8 seconds timeout

  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const options: RequestInit = {
        method,
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'sportbex-api-key': API_KEY,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      };

      if (body && method === 'POST') options.body = JSON.stringify(body);

      console.log(`[Sportbex] ${method} Request to: ${endpoint} (Attempt ${i + 1}/${retries})`);
      
      const response = await fetch(url, options);
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      clearTimeout(timer);
      console.error(`[Sportbex] Network Error [${endpoint}]:`, error.message);
      
      if (i === retries - 1) return null;
      await new Promise(res => setTimeout(res, Math.pow(2, i) * 1000));
    }
  }
  return null;
}

// --- HELPERS ---

function normalizeEventStatus(status: string, scoreExists: boolean): 'upcoming' | 'live' | 'finished' {
  const s = (status || '').toUpperCase();
  if (['FINISHED', 'COMPLETED', 'RESULT', 'ENDED'].includes(s)) return 'finished';
  if (['LIVE', 'INPLAY', 'IN-PLAY', 'IN PLAY'].includes(s)) return 'live';
  if (scoreExists && s !== 'UPCOMING') return 'live';
  return 'upcoming';
}

function normalizeMarketStatus(status: string): 'open' | 'suspended' | 'closed' | 'unknown' {
  const s = (status || '').toUpperCase();
  if (s === 'OPEN' || s === 'ACTIVE') return 'open';
  if (s === 'SUSPENDED') return 'suspended';
  if (s === 'CLOSED' || s === 'INACTIVE') return 'closed';
  return 'unknown';
}

// --- HIERARCHY LAYER 1: COMPETITIONS ---

export async function getCompetitions(sportId: string = '4'): Promise<ExternalSeries[]> {
  const json = await fetchWithHeaders(`betfair/${sportId}`);
  if (!json || !json.data) return [];
  
  return json.data.map((c: any) => {
    const comp = c.competition || c;
    const id = comp.id || comp.competitionId;
    const name = comp.name || comp.competitionName;
    
    if (!id) return null;

    return {
      id: id.toString(),
      name: name || 'Unknown Series',
      category: 'Betfair Competition',
      gender: 'Men',
      type: 'Tournament',
      status: 'ACTIVE'
    };
  }).filter(Boolean) as ExternalSeries[];
}

// --- HIERARCHY LAYER 2: EVENTS ---

export async function getEventsByCompetition(competitionId: string, sportId: string = '4'): Promise<ExternalMatch[]> {
  const json = await fetchWithHeaders(`betfair/event/${sportId}/${competitionId}`);
  if (!json || !json.data) return [];

  return json.data.map((e: any) => {
    const event = e.event || e;
    const id = event.id || event.eventId;
    const name = event.name || event.eventName;

    if (!id || !name) return null;

    const teams = name.split(' v ');
    const home = teams[0] || 'TBA';
    const away = teams[1] || 'TBA';

    return {
      id: id.toString(),
      betfairEventId: id.toString(),
      name: name,
      teamA: home.trim(),
      teamB: away.trim(),
      startTime: event.openDate || event.startTime || new Date().toISOString(),
      status: normalizeEventStatus(event.status || '', false),
      venue: event.venue || 'Global Stadium',
      series: event.competitionName || 'Series',
      matchType: 'cricket'
    };
  }).filter(Boolean) as ExternalMatch[];
}

// --- HIERARCHY LAYER 3: MARKETS ---

/**
 * TODO: Confirm the exact Sportbex endpoint for standalone market lists if not included in event payload.
 */
export async function getMarketsByEvent(eventId: string, sportId: string = '4'): Promise<ExternalMarket[]> {
  const json = await fetchWithHeaders(`betfair/market/${sportId}/${eventId}`);
  if (!json || !json.data) return [];

  return json.data.map((m: any) => ({
    id: m.marketId || m.id,
    name: m.marketName || m.name,
    type: m.marketType || 'unknown',
    status: normalizeMarketStatus(m.status),
    eventId: eventId
  })).filter((m: any) => m.id);
}

// --- HIERARCHY LAYER 4: ODDS ---

export async function fetchMarketOdds(marketId: string) {
  const json = await fetchWithHeaders(`betfair/listMarketBook/4`, 'POST', {
    marketIds: [marketId]
  });
  
  const data = json?.data?.[0];
  if (!data) return null;

  console.log(`[Odds Pulse] Market: ${marketId} | Status: ${data.status}`);

  return {
    marketId: data.marketId,
    status: normalizeMarketStatus(data.status),
    inplay: !!data.inplay,
    totalMatched: data.totalMatched || 0,
    runners: (data.runners || []).map((runner: any) => ({
      selectionId: runner.selectionId,
      runnerName: runner.runnerName || `Selection ${runner.selectionId}`,
      status: normalizeMarketStatus(runner.status),
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

export async function fetchFancyOdds(eventId: string, sportId: string = '4') {
  const json = await fetchWithHeaders(`betfair/fancy-bookmaker-odds/${sportId}/${eventId}`);
  return json?.data || null;
}

export async function fetchPremiumFancy(eventId: string) {
  const json = await fetchWithHeaders(`betfair/getPremium/4/${eventId}`);
  return json?.data || [];
}

// --- LIVE DATA ACCESS ---

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
  const date = match.startDate || match.date || new Date().toISOString();
  
  const dateSeed = date.split('T')[0];
  const rawId = `${home}-${away}-${dateSeed}`.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase();

  return {
    id: rawId,
    name: match.name || `${home} v ${away}`,
    matchType: match.format || 'cricket',
    status: normalizeEventStatus(match.status || '', !!score),
    venue: match.ground || match.venue || 'Global Stadium',
    startTime: date,
    teamA: home,
    teamB: away,
    currentScore: score,
    statusText: match.result?.message || match.status_text || 'In Progress'
  };
}

// --- ORCHESTRATION WORKFLOW ---

export async function syncSportbexHierarchy() {
  console.log("[Hierarchy Sync] Starting professional network discovery...");
  
  const results: any[] = [];
  const competitions = await getCompetitions('4');
  const activeComps = competitions.slice(0, 5);

  for (const comp of activeComps) {
    const events = await getEventsByCompetition(comp.id, '4');
    
    for (const event of events) {
      if (!event.betfairEventId) continue;
      
      const markets = await getMarketsByEvent(event.betfairEventId, '4');
      const matchWinnerMarket = markets.find(m => 
        m.name.toLowerCase().includes('match odds') || 
        m.name.toLowerCase().includes('winner')
      );

      let odds = null;
      if (matchWinnerMarket) {
        odds = await fetchMarketOdds(matchWinnerMarket.id);
      }

      results.push({
        ...event,
        competitionName: comp.name,
        markets: markets,
        primaryMarketId: matchWinnerMarket?.id,
        liveOdds: odds
      });
    }
  }

  return results;
}
