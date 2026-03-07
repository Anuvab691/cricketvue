'use server';

/**
 * @fileOverview Professional SportsMonk v3 API Integration Service.
 * Implements full hierarchy: Leagues -> Fixtures -> Odds/Markets.
 */

import { ExternalMatch } from './cricket-api-service';

const SPORTSMONK_BASE_URL = "https://api.sportmonks.com/v3";
const DEFAULT_TIMEOUT = 10000; // 10 seconds

export interface SportsMonkLeague {
  id: string;
  name: string;
  sportId: number;
  countryId: number;
  active: boolean;
  updatedAt: string;
}

export interface SportsMonkFixture {
  id: string;
  leagueId: string;
  name: string;
  startingAt: string;
  status: string;
  venue?: string;
  homeTeam: string;
  awayTeam: string;
  score?: string;
  markets?: any[];
}

/**
 * Robust fetch helper with timeout and retry logic.
 */
async function fetchSportsMonk(endpoint: string, params: Record<string, string> = {}, retries = 3) {
  const apiToken = process.env.SPORTSMONK_API_TOKEN;
  if (!apiToken) {
    throw new Error("SPORTSMONK_API_TOKEN is missing. Please configure it in your environment.");
  }

  const queryParams = new URLSearchParams({ ...params, api_token: apiToken });
  const url = `${SPORTSMONK_BASE_URL}/${endpoint.replace(/^\//, '')}?${queryParams.toString()}`;

  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      console.log(`[SportsMonk] Fetching: ${endpoint} (Attempt ${i + 1})`);
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) { // Rate limit
          const wait = Math.pow(2, i) * 1000;
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        throw new Error(`SportsMonk API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (i === retries - 1) throw error;
      const wait = Math.pow(2, i) * 1000;
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

/**
 * Normalizes fixture status to app-internal status.
 * TODO: Map more specific SportsMonk statuses (e.g., INPLAY_1ST_HALF) if needed.
 */
function normalizeStatus(smStatus: string): 'upcoming' | 'live' | 'finished' {
  const status = smStatus.toUpperCase();
  const liveStatuses = ['LIVE', 'INPLAY', '1ST', '2ND', 'HT', 'ET', 'PPL'];
  const finishedStatuses = ['FT', 'AET', 'FT_P', 'POSTP', 'CANCL', 'ABD'];
  
  if (liveStatuses.includes(status)) return 'live';
  if (finishedStatuses.includes(status)) return 'finished';
  return 'upcoming';
}

/**
 * Fetches all active Cricket leagues.
 * Endpoint: GET /cricket/leagues
 */
export async function getLeagues(): Promise<SportsMonkLeague[]> {
  try {
    const json = await fetchSportsMonk('cricket/leagues');
    if (!json?.data) return [];

    return json.data.map((league: any) => ({
      id: league.id.toString(),
      name: league.name,
      sportId: league.sport_id,
      countryId: league.country_id,
      active: league.active,
      updatedAt: new Date().toISOString()
    }));
  } catch (error) {
    console.error("[SportsMonk] Failed to fetch leagues:", error);
    return [];
  }
}

/**
 * Fetches fixtures with nested odds/markets to optimize network calls.
 * Endpoint: GET /cricket/fixtures
 * Include: participants,venue,league,score,odds.market
 */
export async function getFixturesWithOdds(date?: string): Promise<ExternalMatch[]> {
  try {
    const filters = date ? { filters: `fixture_date:${date}` } : {};
    const json = await fetchSportsMonk('cricket/fixtures', {
      ...filters,
      include: 'participants;venue;league;score;odds.market',
      // TODO: Confirm if your plan supports 'odds.market' inclusion in the main fixtures endpoint
    });

    if (!json?.data) return [];

    return json.data.map((fixture: any) => {
      const homeParticipant = fixture.participants?.find((p: any) => p.meta?.location === 'home');
      const awayParticipant = fixture.participants?.find((p: any) => p.meta?.location === 'away');
      
      const homeTeam = homeParticipant?.name || 'TBA';
      const awayTeam = awayParticipant?.name || 'TBA';

      // Normalize Odds (Moneyline focus)
      // TODO: Adjust field mapping based on exact SportsMonk odds object structure (value vs price)
      const moneylineMarket = fixture.odds?.find((o: any) => o.market?.name?.toLowerCase().includes('winner') || o.market?.name?.toLowerCase().includes('moneyline'));
      
      const homeBackOdds = moneylineMarket?.values?.find((v: any) => v.outcomes?.some((out: any) => out.name?.toLowerCase().includes('home') || out.name === homeTeam))?.value || 2.0;
      const awayBackOdds = moneylineMarket?.values?.find((v: any) => v.outcomes?.some((out: any) => out.name?.toLowerCase().includes('away') || out.name === awayTeam))?.value || 2.0;

      return {
        id: fixture.id.toString(),
        name: `${homeTeam} v ${awayTeam}`,
        teamA: homeTeam,
        teamB: awayTeam,
        startTime: fixture.starting_at || new Date().toISOString(),
        status: normalizeStatus(fixture.status),
        venue: fixture.venue?.name || 'Global Stadium',
        series: fixture.league?.name || 'International Series',
        matchType: 'cricket',
        currentScore: fixture.score?.description || '0-0',
        statusText: fixture.status || 'Scheduled',
        odds: {
          status: 'OPEN',
          home: {
            back: [{ price: Number(homeBackOdds), size: 1000 }],
            lay: [{ price: Number((Number(homeBackOdds) + 0.05).toFixed(2)), size: 500 }]
          },
          away: {
            back: [{ price: Number(awayBackOdds), size: 1000 }],
            lay: [{ price: Number((Number(awayBackOdds) + 0.05).toFixed(2)), size: 500 }]
          }
        },
        lastUpdated: new Date().toISOString()
      };
    });
  } catch (error) {
    console.error("[SportsMonk] Failed to fetch fixtures:", error);
    return [];
  }
}

/**
 * Master Sync Orchestrator
 */
export async function syncSportsMonkData() {
  console.log("[SportsMonk] Starting Global Sync...");
  
  // 1. Refresh Leagues (Less frequent)
  const leagues = await getLeagues();
  
  // 2. Refresh Fixtures for today (High frequency)
  const fixtures = await getFixturesWithOdds();
  
  return { leagues, fixtures };
}
