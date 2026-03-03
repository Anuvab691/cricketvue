
'use server';

/**
 * @fileOverview Modular Server-Side Service for Cricket Data.
 * Handles various endpoints like Live Scores, Leagues, and Events.
 */

export interface ExternalMatch {
  id: string;
  name: string;
  matchType: string;
  status: string;
  venue: string;
  date: string;
  series?: string;
  teams: string[];
  score?: Array<{
    r: number;
    w: number;
    o: number;
    inning: string;
  }>;
  matchStarted: boolean;
  matchEnded: boolean;
}

export interface ExternalLeague {
  league_key: string;
  league_name: string;
  country_key: string;
  country_name: string;
}

const API_BASE_URL = "https://apiv2.api-cricket.com/cricket/";

/**
 * Generic fetcher for the Cricket API.
 */
async function fetchFromApi(method: string, params: Record<string, string> = {}) {
  const apiKey = process.env.CRICKET_API_KEY;
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE' || apiKey === '') {
    console.warn("Secure Check: Cricket API Key is missing or default.");
    return null;
  }

  const queryParams = new URLSearchParams({
    method,
    APIkey: apiKey,
    ...params
  });

  try {
    const response = await fetch(`${API_BASE_URL}?${queryParams.toString()}`, {
      next: { revalidate: 15 } // Cache for 15 seconds
    });
    
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`API Fetch Error [${method}]:`, error);
    return null;
  }
}

/**
 * Fetches current real-time live matches.
 */
export async function fetchLiveScores(): Promise<ExternalMatch[]> {
  const json = await fetchFromApi('get_livescore');
  return (json?.result || []).map(transformMatch);
}

/**
 * Fetches all available leagues.
 */
export async function fetchLeagues(): Promise<ExternalLeague[]> {
  const json = await fetchFromApi('get_leagues');
  return json?.result || [];
}

/**
 * Fetches events for a specific date range.
 */
export async function fetchEvents(from: string, to: string): Promise<ExternalMatch[]> {
  const json = await fetchFromApi('get_events', { from, to });
  return (json?.result || []).map(transformMatch);
}

/**
 * Fetches current matches by combining Live Scores and Today's Events.
 */
export async function fetchLiveMatches(): Promise<ExternalMatch[]> {
  const today = new Date().toISOString().split('T')[0];
  
  // Parallel fetch for speed
  const [liveScores, todayEvents] = await Promise.all([
    fetchLiveScores(),
    fetchEvents(today, today)
  ]);

  // Merge results, prioritizing Live Scores for the same match ID
  const matchMap = new Map<string, ExternalMatch>();
  
  todayEvents.forEach(m => matchMap.set(m.id, m));
  liveScores.forEach(m => matchMap.set(m.id, m));

  return Array.from(matchMap.values());
}

/**
 * Fetches Head-to-Head data for two teams.
 */
export async function fetchH2HData(teamA: string, teamB: string) {
  return await fetchFromApi('get_h2h', { teamA, teamB });
}

/**
 * Helper to normalize API response to our InternalMatch interface.
 */
function transformMatch(m: any): ExternalMatch {
  return {
    id: m.event_key || m.id || `match-${Math.random().toString(36).substr(2, 9)}`,
    name: `${m.event_home_team} vs ${m.event_away_team}`,
    matchType: normalizeApiMatchType(m.league_name || 't20'),
    status: m.event_status || 'Scheduled',
    venue: m.event_stadium || 'Global Stadium',
    date: m.event_date_start || m.event_date || new Date().toISOString(),
    series: m.league_name || 'International Series',
    teams: [m.event_home_team || 'Team A', m.event_away_team || 'Team B'],
    score: parseScore(m),
    matchStarted: m.event_status !== 'Scheduled' && m.event_status !== 'Cancelled',
    matchEnded: m.event_status === 'Finished' || m.event_status === 'After Pen.'
  };
}

function normalizeApiMatchType(leagueName: string): string {
  const name = leagueName.toLowerCase();
  if (name.includes('t20') || name.includes('ipl') || name.includes('bbl') || name.includes('psl') || name.includes('t-20')) return 't20';
  if (name.includes('test') || name.includes('trophy') || name.includes('shield')) return 'test';
  if (name.includes('odi') || name.includes('one day') || name.includes('world cup')) return 'odi';
  return 'international';
}

function parseScore(m: any) {
  const scores = [];
  if (m.event_home_final_result) {
    scores.push({ inning: m.event_home_team, r: parseInt(m.event_home_final_result) || 0, w: 0, o: 0 });
  }
  if (m.event_away_final_result) {
    scores.push({ inning: m.event_away_team, r: parseInt(m.event_away_final_result) || 0, w: 0, o: 0 });
  }
  return scores;
}
