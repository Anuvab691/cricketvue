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
    throw new Error("SPORTBEX_API_KEY is missing. Check your Firebase/Local env settings.");
  }

  const queryParams = new URLSearchParams(params);
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const url = `${SPORTBEX_BASE_URL}${cleanEndpoint}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      console.log(`[Sportbex] Syncing endpoint: ${endpoint} (Attempt ${i + 1})`);
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
          console.warn("[Sportbex] Rate limited. Waiting...");
          await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
          continue;
        }
        console.error(`[Sportbex] API HTTP Error: ${response.status} at ${endpoint}`);
        const errText = await response.text();
        console.error(`[Sportbex] Response Body:`, errText);
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
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

/**
 * normalizeLiveMatch() - Maps Sportbex fields to consistent app structure.
 */
function normalizeLiveMatch(match: any): ExternalMatch | null {
  // Defensive mapping for team names
  const teamA = match.t1_name || match.home_team_name || match.team_a;
  const teamB = match.t2_name || match.away_team_name || match.team_b;

  if (!teamA || !teamB) {
    console.warn("[Sportbex] Skipping match with incomplete team data", match.id);
    return null;
  }

  // Stable ID generation
  const matchId = match.id?.toString() || 
    `${teamA}-${teamB}-${match.startDate || match.date || Date.now()}`.replace(/\s+/g, '-').toLowerCase();

  // Status normalization (Cricket specific variations)
  const rawStatus = (match.status || match.match_status || '').toUpperCase();
  let status: 'upcoming' | 'live' | 'finished' = 'upcoming';
  
  const liveTriggers = [
    'LIVE', 'INPLAY', 'IN_PROGRESS', '1ST INNINGS', '2ND INNINGS', 
    'BAT', 'TOSS', 'START', 'STR', 'PLAYING'
  ];
  
  const finishedTriggers = [
    'COMPLETED', 'FINISHED', 'RESULT', 'ABANDONED', 'CANCL', 'POSTP', 'DRAW'
  ];

  if (liveTriggers.some(t => rawStatus.includes(t))) {
    status = 'live';
  } else if (finishedTriggers.some(t => rawStatus.includes(t))) {
    status = 'finished';
  }

  const scoreText = match.current_score || match.score || 'TBD';

  return {
    id: matchId,
    name: match.name || `${teamA} v ${teamB}`,
    matchType: match.matchType || match.type || 'cricket',
    status,
    venue: match.ground || match.venue || 'International Venue',
    startTime: match.startDate || match.date || new Date().toISOString(),
    teamA,
    teamB,
    score: scoreText,
    currentScore: scoreText,
    statusText: match.result?.message || match.status_text || match.status || 'Match Active',
    lastUpdated: new Date().toISOString(),
    series: match.series_name || match.series || 'Live Series',
    // Simulated professional odds for the exchange interface (mapped to SGO-style markets)
    odds: {
      status: 'OPEN',
      home: { back: [{ price: 1.90, size: 500 }], lay: [{ price: 1.94, size: 200 }] },
      away: { back: [{ price: 1.90, size: 500 }], lay: [{ price: 1.94, size: 200 }] },
      draw: { back: [{ price: 3.50, size: 100 }], lay: [{ price: 3.70, size: 50 }] }
    }
  };
}

/**
 * fetchLiveMatches() - Fetches from the /live-score/match/live endpoint.
 */
export async function fetchLiveMatches(): Promise<any[]> {
  try {
    const json = await fetchWithHeaders('live-score/match/live');
    // Sportbex trial-api structure handling
    if (json?.data?.matches) return json.data.matches;
    if (json?.data && Array.isArray(json.data)) return json.data;
    if (json?.matches && Array.isArray(json.matches)) return json.matches;
    
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
  console.log("[Sportbex] Initiating Global Network Sync...");
  const rawMatches = await fetchLiveMatches();
  
  if (!rawMatches || rawMatches.length === 0) {
    console.log("[Sportbex] No live matches returned from the pulse.");
    return { fixtures: [] };
  }

  const liveMatches = rawMatches
    .map(normalizeLiveMatch)
    .filter((m): m is ExternalMatch => m !== null);

  console.log(`[Sportbex] Successfully ingested ${liveMatches.length} matches.`);
  return { fixtures: liveMatches };
}

export async function fetchPremiumFancy(eventId: string) {
  // Placeholder for high-liquidity fancy markets
  return [];
}
