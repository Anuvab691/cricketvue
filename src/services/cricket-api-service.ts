
'use server';

/**
 * @fileOverview Modular Server-Side Service for Cricket Data.
 * Handles various endpoints like Live Scores, H2H, and League Events.
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
export async function fetchLiveMatches(): Promise<ExternalMatch[]> {
  const json = await fetchFromApi('get_livescores');
  
  if (!json || !Array.isArray(json.result)) {
    // If livescores is empty, fallback to events for today
    const events = await fetchFromApi('get_events', {
      from: new Date().toISOString().split('T')[0],
      to: new Date().toISOString().split('T')[0]
    });
    return (events?.result || []).map(transformMatch);
  }

  return json.result.map(transformMatch);
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
    matchType: (m.league_name || 't20').toLowerCase(),
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

function parseScore(m: any) {
  const scores = [];
  if (m.event_home_final_result) {
    scores.push({ inning: m.event_home_team, r: parseInt(m.event_home_final_result), w: 0, o: 0 });
  }
  if (m.event_away_final_result) {
    scores.push({ inning: m.event_away_team, r: parseInt(m.event_away_final_result), w: 0, o: 0 });
  }
  return scores;
}
