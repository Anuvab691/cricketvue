'use server';

/**
 * @fileOverview Professional Sportbex API Integration Service.
 * 
 * - fetchWithHeaders - Robust fetch helper with timeout and retries.
 * - fetchLiveMatches - Calls /live-score/match/live.
 * - normalizeLiveMatch - Maps Sportbex fields to app-internal ExternalMatch.
 * - getLiveMatches - Returns normalized live matches only.
 */

export interface ExternalMatch {
  id: string;
  name: string;
  matchType: string;
  status: 'upcoming' | 'live' | 'finished';
  venue: string;
  startTime: string;
  teamA: string;
  teamB: string;
  score: string;
  currentScore: string;
  statusText: string;
  lastUpdated: string;
  odds?: any; // To be populated if odds endpoint is identified
  series?: string;
}

const SPORTBEX_BASE_URL = "https://trial-api.sportbex.com/api/";
const DEFAULT_TIMEOUT = 10000;

/**
 * fetchWithHeaders() - Robust fetch helper with timeout and retry logic.
 */
async function fetchWithHeaders(endpoint: string, params: Record<string, string> = {}, retries = 3) {
  const apiKey = process.env.SPORTBEX_API_KEY;
  if (!apiKey) {
    console.error("[Sportbex] CRITICAL: API Key missing in environment.");
    throw new Error("SPORTBEX_API_KEY is missing. Please configure it in your environment.");
  }

  const queryParams = new URLSearchParams(params);
  const url = `${SPORTBEX_BASE_URL}${endpoint.replace(/^\//, '')}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      console.log(`[Sportbex] Requesting: ${endpoint} (Attempt ${i + 1})`);
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        headers: { 
          'Accept': 'application/json',
          'sportbex-api-key': apiKey
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn("[Sportbex] Rate limited. Retrying...");
          await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
          continue;
        }
        console.error(`[Sportbex] API Error: ${response.status} at ${endpoint}`);
        throw new Error(`Sportbex API Error: ${response.status}`);
      }

      const json = await response.json();
      return json;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (i === retries - 1) {
        console.error(`[Sportbex] Final fetch failure for ${endpoint}:`, error.message);
        throw error;
      }
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
}

/**
 * normalizeLiveMatch() - Maps Sportbex fields to consistent app structure.
 */
function normalizeLiveMatch(match: any): ExternalMatch | null {
  // Defensive check for required fields
  const teamA = match.t1_name || match.home_team_name;
  const teamB = match.t2_name || match.away_team_name;

  if (!teamA || !teamB) return null;

  // ID fallback logic
  const matchId = match.id?.toString() || `${teamA}-${teamB}-${match.startDate || match.date}`.replace(/\s+/g, '-').toLowerCase();

  // Status normalization logic
  const rawStatus = (match.status || match.match_status || '').toUpperCase();
  let status: 'upcoming' | 'live' | 'finished' = 'upcoming';
  if (['LIVE', 'INPLAY', 'IN_PROGRESS', '1ST INNINGS', '2ND INNINGS'].includes(rawStatus)) {
    status = 'live';
  } else if (['COMPLETED', 'FINISHED', 'RESULT', 'ABANDONED'].includes(rawStatus)) {
    status = 'finished';
  }

  // Score mapping
  const score = match.current_score || match.score || 'TBD';

  return {
    id: matchId,
    name: match.name || `${teamA} v ${teamB}`,
    matchType: match.matchType || match.type || 'cricket',
    status,
    venue: match.ground || match.venue || 'Global Stadium',
    startTime: match.startDate || match.date || new Date().toISOString(),
    teamA,
    teamB,
    score,
    currentScore: score,
    statusText: match.result?.message || match.status_text || match.status || 'Match in Progress',
    lastUpdated: new Date().toISOString(),
    series: match.series_name || match.series || 'Live Series',
    // Mock odds for UI compatibility since /live doesn't always provide bookmaker markets
    odds: {
      status: 'OPEN',
      home: { back: [{ price: 1.91, size: 500 }], lay: [{ price: 1.95, size: 200 }] },
      away: { back: [{ price: 1.91, size: 500 }], lay: [{ price: 1.95, size: 200 }] }
    }
  };
}

/**
 * fetchLiveMatches() - Fetches from the /live-score/match/live endpoint.
 */
export async function fetchLiveMatches(): Promise<any[]> {
  try {
    const json = await fetchWithHeaders('live-score/match/live');
    // Support both data.matches and data directly
    return json?.data?.matches || json?.data || [];
  } catch (error) {
    console.error("[Sportbex] Live fetch error:", error);
    return [];
  }
}

/**
 * getLiveMatches() - Public interface returning normalized matches.
 */
export async function getLiveMatches(): Promise<ExternalMatch[]> {
  const matches = await fetchLiveMatches();
  return matches
    .map(normalizeLiveMatch)
    .filter((m): m is ExternalMatch => m !== null);
}

/**
 * syncSportbexData() - Master orchestrator for the terminal sync action.
 */
export async function syncSportbexData() {
  console.log("[Sportbex] Starting Live Network Sync...");
  const liveMatches = await getLiveMatches();
  console.log(`[Sportbex] Found ${liveMatches.length} active live matches.`);
  return { fixtures: liveMatches, leagues: [] };
}

// Backward compatibility wrappers for existing actions
export async function fetchLiveScores() { return getLiveMatches(); }
export async function fetchPremiumFancy(eventId: string) { return []; }
export async function syncSportsMonkData() { return syncSportbexData(); }
