'use server';

/**
 * @fileOverview Professional SportsMonk v3 API Integration Service.
 * Implements full hierarchy: Leagues -> Fixtures -> Odds/Markets.
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
    console.error("[SportsMonk] CRITICAL: API Token missing in environment.");
    throw new Error("SPORTSMONK_API_TOKEN is missing. Please configure it in your environment.");
  }

  const queryParams = new URLSearchParams({ ...params, api_token: apiToken });
  const url = `${SPORTSMONK_BASE_URL}/${endpoint.replace(/^\//, '')}?${queryParams.toString()}`;

  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      console.log(`[SportsMonk] Requesting: ${endpoint} (Attempt ${i + 1})`);
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn("[SportsMonk] Rate limited. Retrying...");
          await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
          continue;
        }
        console.error(`[SportsMonk] API Error: ${response.status} at ${endpoint}`);
        throw new Error(`SportsMonk API Error: ${response.status}`);
      }

      const json = await response.json();
      return json;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (i === retries - 1) {
        console.error(`[SportsMonk] Final fetch failure for ${endpoint}:`, error.message);
        throw error;
      }
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
}

/**
 * normalizeStatus() - Maps SportsMonk Cricket status codes to app-internal status.
 */
function normalizeStatus(smStatus: any): 'upcoming' | 'live' | 'finished' {
  // SportsMonk v3 Cricket often uses "state" strings
  const status = String(smStatus || '').toUpperCase();
  
  const live = ['LIVE', 'INPLAY', '1ST INNINGS', '2ND INNINGS', '1ST INNINGS (IN PLAY)', '2ND INNINGS (IN PLAY)', 'HT'];
  const finished = ['FT', 'FINISHED', 'COMPLETED', 'ABANDONED', 'CANCL', 'POSTP'];
  
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
    if (!json?.data) {
      console.log("[SportsMonk] No league data returned.");
      return [];
    }

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
    // Note: 'state' is a common field in SportsMonk v3 Cricket fixtures
    const json = await fetchWithHeaders('cricket/fixtures', {
      include: 'participants;venue;league;score;odds.market',
    });

    if (!json?.data) {
      console.log("[SportsMonk] No fixture data returned.");
      return [];
    }

    console.log(`[SportsMonk] Processing ${json.data.length} fixtures...`);

    return json.data.map((fixture: any) => {
      const homeTeamObj = fixture.participants?.find((p: any) => p.meta?.location === 'home');
      const awayTeamObj = fixture.participants?.find((p: any) => p.meta?.location === 'away');
      
      const homeTeam = homeTeamObj?.name || 'TBA';
      const awayTeam = awayTeamObj?.name || 'TBA';

      // Odds Extraction (Moneyline/Winner)
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

      // Status extraction (state is often the descriptive status in v3)
      const smStatusText = fixture.state || fixture.status || 'Scheduled';

      return {
        id: fixture.id.toString(),
        name: `${homeTeam} v ${awayTeam}`,
        teamA: homeTeam,
        teamB: awayTeam,
        startTime: fixture.starting_at || new Date().toISOString(),
        status: normalizeStatus(smStatusText),
        venue: fixture.venue?.name || 'Global Stadium',
        series: fixture.league?.name || 'International Series',
        matchType: 'cricket',
        currentScore: fixture.score?.description || 'TBD',
        statusText: smStatusText,
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
 * fetchLiveScores() - Compatibility wrapper for live updates.
 */
export async function fetchLiveScores(): Promise<ExternalMatch[]> {
  return getFixturesWithOdds();
}

/**
 * fetchPremiumFancy() - Placeholder for micro-markets if available in odds.
 */
export async function fetchPremiumFancy(eventId: string): Promise<any[]> {
  return [];
}

/**
 * syncSportsMonkData() - Master Sync Orchestrator
 */
export async function syncSportsMonkData() {
  console.log("[SportsMonk] Initializing Professional Sync Pipeline...");
  const leagues = await getLeagues();
  const fixtures = await getFixturesWithOdds();
  console.log(`[SportsMonk] Pipeline complete. Found ${leagues.length} leagues and ${fixtures.length} fixtures.`);
  return { leagues, fixtures };
}
