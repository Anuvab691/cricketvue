'use server';

/**
 * @fileOverview Professional SportsMonk v3 API Integration Service.
 * Implements full hierarchy: Leagues -> Fixtures -> Odds/Markets.
 * Replaces legacy SportsGameOdds integration.
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
  currentScore?: string;
  statusText?: string;
  odds?: any;
  lastUpdated?: string;
}

export interface SportsMonkLeague {
  id: string;
  name: string;
  sportId: number;
  countryId: number;
  active: boolean;
  updatedAt: string;
}

const SPORTSMONK_BASE_URL = "https://api.sportmonks.com/v3";
const DEFAULT_TIMEOUT = 10000;

/**
 * fetchWithHeaders() - Robust fetch helper with timeout and retry logic.
 */
async function fetchWithHeaders(endpoint: string, params: Record<string, string> = {}, retries = 3) {
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
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
          continue;
        }
        throw new Error(`SportsMonk API Error: ${response.status} - ${url}`);
      }

      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
}

/**
 * normalizeStatus() - Maps SportsMonk status codes to app-internal status.
 */
function normalizeStatus(smStatus: string): 'upcoming' | 'live' | 'finished' {
  const status = smStatus.toUpperCase();
  const live = ['LIVE', 'INPLAY', '1ST', '2ND', 'HT', '2ND_HALF', '1ST_HALF'];
  const finished = ['FT', 'AET', 'POSTP', 'CANCL', 'ABD', 'FINISHED'];
  if (live.includes(status)) return 'live';
  if (finished.includes(status)) return 'finished';
  return 'upcoming';
}

/**
 * getLeagues() - Fetches all active Cricket leagues.
 */
export async function getLeagues(): Promise<SportsMonkLeague[]> {
  try {
    const json = await fetchWithHeaders('cricket/leagues');
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
 * getFixturesWithOdds() - Fetches fixtures with nested odds/markets.
 */
export async function getFixturesWithOdds(): Promise<ExternalMatch[]> {
  try {
    const json = await fetchWithHeaders('cricket/fixtures', {
      include: 'participants;venue;league;score;odds.market',
    });

    if (!json?.data) return [];

    return json.data.map((fixture: any) => {
      const homeTeamObj = fixture.participants?.find((p: any) => p.meta?.location === 'home');
      const awayTeamObj = fixture.participants?.find((p: any) => p.meta?.location === 'away');
      
      const homeTeam = homeTeamObj?.name || 'TBA';
      const awayTeam = awayTeamObj?.name || 'TBA';

      const moneylineMarket = fixture.odds?.find((o: any) => 
        o.market?.name?.toLowerCase().includes('winner') || 
        o.market?.name?.toLowerCase().includes('moneyline')
      );
      
      const homeBackOdds = moneylineMarket?.values?.find((v: any) => 
        v.outcomes?.some((out: any) => out.name?.toLowerCase().includes('home') || out.name === homeTeam)
      )?.value || 2.0;
      
      const awayBackOdds = moneylineMarket?.values?.find((v: any) => 
        v.outcomes?.some((out: any) => out.name?.toLowerCase().includes('away') || out.name === awayTeam)
      )?.value || 2.0;

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
 * fetchLiveScores() - Legacy compatibility wrapper.
 */
export async function fetchLiveScores(): Promise<ExternalMatch[]> {
  return getFixturesWithOdds();
}

/**
 * fetchPremiumFancy() - Legacy compatibility wrapper for micro-markets.
 */
export async function fetchPremiumFancy(eventId: string): Promise<any[]> {
  // TODO: Implement specific SportsMonk fancy market retrieval from fixture.odds
  return [];
}

/**
 * syncSportsMonkData() - Master Sync Orchestrator
 */
export async function syncSportsMonkData() {
  console.log("[SportsMonk] Initiating Universal Sync...");
  const leagues = await getLeagues();
  const fixtures = await getFixturesWithOdds();
  return { leagues, fixtures };
}
