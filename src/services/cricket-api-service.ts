'use server';

/**
 * @fileOverview Professional Service for Sportbex API.
 * Integrated with Betfair Discovery Chain for live market mapping.
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
  currentScore?: string;
  matchStarted: boolean;
  matchEnded: boolean;
  statusText?: string;
  marketId?: string;
  betfairEventId?: string; // Professional Mapping ID
  odds?: {
    home: { back: number; lay: number };
    away: { back: number; lay: number };
  };
  lastUpdated?: string;
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

export interface NormalizedMarketBook {
  marketId: string;
  status: string;
  inplay: boolean;
  totalMatched: number;
  runners: {
    selectionId: number;
    runnerName?: string;
    back: { price: number; size: number }[];
    lay: { price: number; size: number }[];
    lastPriceTraded: number;
  }[];
}

const SPORTBEX_BASE_URL = "https://trial-api.sportbex.com/api/";
const API_KEY = 'EXqcenzWl6ZPT7WnM9CwMf1ZWrnw7Cm9tkLXL7tD';

async function fetchFromSportbex(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any) {
  const envKey = process.env.SPORTBEX_API_KEY;
  const url = `${SPORTBEX_BASE_URL}${endpoint.replace(/^\//, '')}`;
  try {
    const options: RequestInit = {
      method,
      cache: 'no-store',
      headers: { 
        'sportbex-api-key': envKey || API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };
    if (body && method === 'POST') options.body = JSON.stringify(body);
    const response = await fetch(url, options);
    if (!response.ok) return null;
    return await response.json();
  } catch (error: any) {
    console.error(`Sportbex Error [${endpoint}]:`, error.message);
    return null;
  }
}

/**
 * Professional implementation to fetch market odds via listMarketBook.
 * Implements the normalized transformer to ensure UI receives clean data.
 */
export async function fetchMarketOdds(marketId: string): Promise<NormalizedMarketBook | null> {
  const apiKey = process.env.SPORTBEX_API_KEY || API_KEY;

  if (!apiKey) {
    console.error("SPORTBEX_API_KEY missing");
    return null;
  }

  const url = "https://trial-api.sportbex.com/api/betfair/listMarketBook/4";

  try {
    const res = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        "sportbex-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        marketIds: [marketId]
      })
    });

    if (!res.ok) {
      console.error("Failed to fetch market odds", res.status);
      return null;
    }

    const json = await res.json();
    const data = json.data?.[0];

    if (!data) return null;

    // Server-side verification log
    console.log("marketBook sample:", JSON.stringify(data.runners?.[0], null, 2));

    // Professional Normalization Transformer
    const normalized: NormalizedMarketBook = {
      marketId: data.marketId,
      status: data.status,
      inplay: !!data.inplay,
      totalMatched: data.totalMatched || 0,
      runners: (data.runners || []).map((runner: any) => ({
        selectionId: runner.selectionId,
        runnerName: runner.runnerName,
        lastPriceTraded: runner.lastPriceTraded || 0,
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

    return normalized;

  } catch (err) {
    console.error("Sportbex odds fetch error:", err);
    return null;
  }
}

/**
 * Professional Premium Fancy odds fetcher.
 */
export async function fetchPremiumFancy(eventId: string) {
  const apiKey = process.env.SPORTBEX_API_KEY || API_KEY;

  if (!apiKey) {
    console.warn("SPORTBEX_API_KEY missing");
    return [];
  }

  const url = `https://trial-api.sportbex.com/api/betfair/getPremium/4/${eventId}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        "sportbex-api-key": apiKey,
        "Accept": "application/json"
      }
    });

    if (!res.ok) {
      console.error("Premium Fancy fetch failed", res.status);
      return [];
    }

    const json = await res.json();
    return json?.data || [];
  } catch (err) {
    console.error("Premium Fancy error", err);
    return [];
  }
}

/**
 * Discovery Phase 1: All Ongoing Competitions
 */
export async function fetchBetfairCompetitions(sportId: string = '4') {
  const json = await fetchFromSportbex(`betfair/${sportId}`);
  return json?.data || [];
}

/**
 * Discovery Phase 2: All Events for a Competition
 */
export async function fetchBetfairEvents(competitionId: string, sportId: string = '4') {
  const json = await fetchFromSportbex(`betfair/event/${sportId}/${competitionId}`);
  return json?.data || [];
}

/**
 * Discovery Phase 4: Fancy and Bookmaker Odds (GET)
 */
export async function fetchFancyOdds(eventId: string, sportId: string = '4') {
  if (!eventId) return null;
  const json = await fetchFromSportbex(`betfair/fancy-bookmaker-odds/${sportId}/${eventId}`);
  return json?.data || null;
}

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

export async function fetchMatchDetail(matchId: string): Promise<ExternalMatch | null> {
  try {
    const json = await fetchFromSportbex(`live-score/match/${matchId}`);
    if (!json || !json.data) return null;
    return transformSportbexLiveMatch(json.data, matchId);
  } catch (e) {
    return null;
  }
}

export async function fetchLiveSeries(): Promise<ExternalSeries[]> {
  try {
    const json = await fetchFromSportbex(`live-score/series?page=1&perPage=10&year=2025`);
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

function transformSportbexLiveMatch(match: any, originalId?: string): ExternalMatch {
  const teamsData = match.teams || {};
  let homeName = match.t1_name || match.home_team_name || 'TBA';
  let awayName = match.t2_name || match.away_team_name || 'TBA';

  if (homeName === 'TBA' && Array.isArray(match.teams) && match.teams.length >= 2) {
    homeName = match.teams[0]?.name || match.teams[0] || 'TBA';
    awayName = match.teams[1]?.name || match.teams[1] || 'TBA';
  } else if (homeName === 'TBA' && (teamsData.t1 || teamsData.t2)) {
    homeName = teamsData.t1?.name || 'TBA';
    awayName = teamsData.t2?.name || 'TBA';
  }
  
  let scoreText = match.current_score || match.score || (teamsData.t1?.score ? `${teamsData.t1.score} v ${teamsData.t2?.score}` : '');

  const statusRaw = (match.status || '').toUpperCase();
  const isCompleted = ['COMPLETED', 'FINISHED', 'RESULT'].includes(statusRaw);
  const isLive = match.isLive === true || statusRaw === 'LIVE' || !!scoreText;

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
    currentScore: scoreText,
    matchStarted: isLive || isCompleted,
    matchEnded: isCompleted,
    statusText: match.result?.message || match.status_text || (isLive ? 'In Play' : 'Scheduled')
  };
}