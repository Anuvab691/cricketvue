'use server';

/**
 * @fileOverview Professional Sportbex API Integration Service.
 * 
 * - fetchWithHeaders - Robust fetch helper with timeout and retries.
 * - fetchLiveMatches - Calls /live-score/match/live.
 * - normalizeLiveMatch - Maps Sportbex fields to internal app structure.
 * - syncSportbexData - Master orchestrator for the terminal sync.
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
  series?: string;
  odds?: {
    status: string;
    home: { back: any[]; lay: any[] };
    away: { back: any[]; lay: any[] };
    draw: { back: any[]; lay: any[] };
  };
}

const SPORTBEX_BASE_URL = "https://trial-api.sportbex.com/api/";
const DEFAULT_TIMEOUT = 12000;

/**
 * fetchWithHeaders() - Robust fetch helper with timeout and retry logic.
 */
async function fetchWithHeaders(endpoint: string, params: Record<string, string> = {}, retries = 3) {
  const apiKey = process.env.SPORTBEX_API_KEY;
  if (!apiKey) {
    console.error("[Sportbex] CRITICAL: SPORTBEX_API_KEY is missing in environment.");
    throw new Error("SPORTBEX_API_KEY is missing. Please add it to your environment variables.");
  }

  const queryParams = new URLSearchParams(params);
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const url = `${SPORTBEX_BASE_URL}${cleanEndpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      console.log(`[Sportbex] Pulsing Network: ${endpoint} (Attempt ${i + 1})`);
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
        const errText = await response.text();
        console.error(`[Sportbex] API Error ${response.status} for ${endpoint}:`, errText);
        
        // Handle rate limiting specifically
        if (response.status === 429) {
          const delay = Math.pow(2, i) * 1000;
          console.log(`[Sportbex] Rate limited (429). Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        
        throw new Error(`Sportbex API Error: ${response.status}`);
      }

      const json = await response.json();
      return json;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (i === retries - 1) {
        console.error(`[Sportbex] Connection Failure for ${endpoint} after ${retries} attempts:`, error.message);
        throw error;
      }
      // Delay before standard retry
      const delay = 1000 * (i + 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/**
 * normalizeLiveMatch() - Maps Sportbex fields to consistent app structure.
 * Strictly adheres to normalization rules provided for status and data fallbacks.
 */
function normalizeLiveMatch(match: any): ExternalMatch | null {
  const teamA =
    match.t1_name ||
    match.home_team_name ||
    match.team_a ||
    match.team_home ||
    match.home_name;

  const teamB =
    match.t2_name ||
    match.away_team_name ||
    match.team_b ||
    match.team_away ||
    match.away_name;

  if (!teamA || !teamB) {
    console.warn("[Sportbex] Skipping match due to incomplete participant data", match?.id);
    return null;
  }

  const matchId =
    match.id?.toString() ||
    match.match_id?.toString() ||
    `${teamA}-${teamB}-${match.startDate || match.date || "unknown"}`
      .replace(/\s+/g, "-")
      .toLowerCase();

  const rawStatus = String(match.status || match.match_status || "").toUpperCase();

  let status: "upcoming" | "live" | "finished" = "upcoming";

  const upcomingTriggers = ["UPCOMING", "SCHEDULED", "NOT STARTED"];
  const liveTriggers = ["LIVE", "INPLAY", "IN_PROGRESS", "1ST INNINGS", "2ND INNINGS", "PLAYING"];
  const finishedTriggers = [
    "COMPLETED",
    "FINISHED",
    "RESULT",
    "ABANDONED",
    "CANCELLED",
    "CANCL",
    "POSTPONED",
    "POSTP",
    "DRAW"
  ];

  if (upcomingTriggers.some(t => rawStatus.includes(t))) {
    status = "upcoming";
  } else if (liveTriggers.some(t => rawStatus.includes(t))) {
    status = "live";
  } else if (finishedTriggers.some(t => rawStatus.includes(t))) {
    status = "finished";
  }

  const scoreText =
    match.current_score ||
    match.score ||
    match.live_score ||
    "";

  return {
    id: matchId,
    name: match.name || `${teamA} v ${teamB}`,
    matchType: match.matchType || match.type || "unknown",
    status,
    venue: match.ground || match.venue || match.location || "Venue unavailable",
    startTime: match.startDate || match.date || match.match_date || "",
    teamA,
    teamB,
    score: scoreText,
    currentScore: scoreText,
    statusText:
      match.result?.message ||
      match.status_text ||
      match.status ||
      "Status unavailable",
    lastUpdated: new Date().toISOString(),
    series: match.series_name || match.series || match.competition_name || "Unknown Series",
    odds: undefined // DO NOT inject fake odds or placeholder betting data
  };
}

/**
 * fetchLiveMatches() - Fetches from the /live-score/match/live endpoint.
 */
export async function fetchLiveMatches(): Promise<any[]> {
  try {
    const json = await fetchWithHeaders('live-score/match/live');
    
    // Support various response wrappers common in trial APIs
    if (json?.data?.matches && Array.isArray(json.data.matches)) return json.data.matches;
    if (json?.data && Array.isArray(json.data)) return json.data;
    if (json?.matches && Array.isArray(json.matches)) return json.matches;
    if (Array.isArray(json)) return json;
    
    return [];
  } catch (error) {
    console.error("[Sportbex] API Fetch Exception:", error);
    return [];
  }
}

/**
 * syncSportbexData() - Master orchestrator for the terminal sync action.
 */
export async function syncSportbexData() {
  console.log("[Sportbex] Initiating Master Network Sync...");
  const rawMatches = await fetchLiveMatches();
  
  if (!rawMatches || rawMatches.length === 0) {
    console.log("[Sportbex] Zero matches identified in current pulse.");
    return { fixtures: [] };
  }

  console.log(`[Sportbex] Raw matches received: ${rawMatches.length}`);

  const liveMatches = rawMatches
    .map(normalizeLiveMatch)
    .filter((m): m is ExternalMatch => m !== null);

  console.log(`[Sportbex] Valid normalized matches: ${liveMatches.length}`);
  return { fixtures: liveMatches };
}

export async function fetchPremiumFancy(eventId: string) {
  /**
   * TODO: Connect to a real Sportbex fancy market endpoint once available.
   * Currently, this is a stub as no fancy market endpoint is implemented for the trial.
   */
  return [];
}
