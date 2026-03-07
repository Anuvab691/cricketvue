'use server';

/**
 * @fileOverview Professional Service for SportsGameOdds (SGO) API.
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

const SGO_BASE_URL = "https://api.sportsgameodds.com/api/";
const API_KEY = process.env.SGO_API_KEY;

if (!API_KEY) {
  console.warn("CRITICAL ERROR: SGO_API_KEY is not defined in the environment variables.");
}

async function fetchWithHeaders(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any, retries: number = 3) {
  if (!API_KEY) {
    throw new Error("SGO_API_KEY missing. Check your environment configuration.");
  }

  const url = `${SGO_BASE_URL}${endpoint.replace(/^\//, '')}`;
  const timeout = 8000;

  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const options: RequestInit = {
        method,
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'sgo-api-key': API_KEY,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      };

      if (body && method === 'POST') options.body = JSON.stringify(body);
      
      const response = await fetch(url, options);
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      return json;
    } catch (error: any) {
      clearTimeout(timer);
      if (i === retries - 1) {
        console.error(`SGO API Final Failure [${endpoint}]:`, error.message);
        return null;
      }
      await new Promise(res => setTimeout(res, Math.pow(2, i) * 1000));
    }
  }
  return null;
}

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

export async function fetchMarketOdds(marketId: string) {
  const json = await fetchWithHeaders(`betfair/listMarketBook/4`, 'POST', {
    marketIds: [marketId]
  });
  
  const market = json?.data?.[0];
  if (!market) return null;

  console.log("SGO Market Pulse:", market.status, "inplay:", market.inplay, "totalMatched:", market.totalMatched);

  return {
    marketId: market.marketId,
    status: normalizeMarketStatus(market.status),
    inplay: !!market.inplay,
    totalMatched: market.totalMatched || 0,
    runners: (market.runners || []).map((runner: any) => ({
      selectionId: runner.selectionId,
      runnerName: runner.runnerName || `Selection ${runner.selectionId}`,
      status: normalizeMarketStatus(runner.status),
      lastPriceTraded: runner.lastPriceTraded ?? null,
      back: runner.ex?.availableToBack?.slice(0, 3) ?? [],
      lay: runner.ex?.availableToLay?.slice(0, 3) ?? []
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

export async function fetchLiveScores(): Promise<ExternalMatch[]> {
  const json = await fetchWithHeaders(`live-score/match/live`);
  if (!json || !json.data) return [];
  const matchesArray = json.data.matches || (Array.isArray(json.data) ? json.data : []);
  
  const transformed = await Promise.all(matchesArray.map(async (m: any) => {
    return await transformLiveMatch(m);
  }));
  
  return transformed;
}

export async function transformLiveMatch(match: any): Promise<ExternalMatch> {
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

export async function syncSgoHierarchy() {
  const results: any[] = [];
  const competitions = await getCompetitions('4');
  const activeComps = competitions.slice(0, 5);

  for (const comp of activeComps) {
    const events = await getEventsByCompetition(comp.id, '4');
    
    for (const event of events) {
      if (!event.betfairEventId) continue;
      
      const markets = await getMarketsByEvent(event.betfairEventId, '4');
      const matchWinnerMarket = markets.find(m => {
        const name = (m.name || '').toLowerCase();
        return name.includes('match odds') || name.includes('match winner') || name === 'winner';
      });

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
