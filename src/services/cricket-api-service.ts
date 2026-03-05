'use server';

/**
 * @fileOverview High-Performance Server-Side Service for Sportbex Cricket API.
 * Optimized for real-time score construction and professional exchange odds.
 */

export interface ExternalMatch {
  id: string;
  name: string;
  matchType: string;
  status: string;
  venue: string;
  date: string;
  series?: string;
  seriesId?: string;
  teams: string[];
  score?: Array<{
    inning: string;
    r: string;
  }>;
  matchStarted: boolean;
  matchEnded: boolean;
  rawStatusText?: string;
  probabilities?: {
    home: number;
    away: number;
    draw?: number;
  };
}

export interface ExternalTournament {
  id: string;
  name: string;
  category: string;
  gender: string;
  type: string;
}

const SPORTBEX_BASE_URL = "https://api.sportbex.com/v1/cricket/";

/**
 * Core fetcher utilizing 'no-store' to ensure zero caching for live Sportbex data.
 */
async function fetchFromSportbex(endpoint: string) {
  const apiKey = process.env.SPORTBEX_API_KEY;
  if (!apiKey) {
    return null;
  }

  const cleanEndpoint = endpoint.replace(/^\//, '');
  const url = `${SPORTBEX_BASE_URL}${cleanEndpoint}?api_key=${apiKey}`;

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    
    if (response.status === 401 || response.status === 403) {
      console.warn("Sportbex Auth Error: Verify your SPORTBEX_API_KEY.");
      return null;
    }

    if (!response.ok) return null;

    return await response.json();
  } catch (error: any) {
    console.error(`Sportbex Network Error [${endpoint}]:`, error.message);
    return null;
  }
}

export async function fetchLiveMatches(): Promise<ExternalMatch[]> {
  try {
    const json = await fetchFromSportbex('live');
    if (!json || !json.data) return [];
    return json.data.map(transformSportbexMatch);
  } catch (e) {
    return [];
  }
}

export async function fetchDailySchedule(dateString?: string): Promise<ExternalMatch[]> {
  const date = dateString || new Date().toISOString().split('T')[0];
  try {
    const json = await fetchFromSportbex(`schedule/${date}`);
    if (!json || !json.data) return [];
    return json.data.map(transformSportbexMatch);
  } catch (e) {
    return [];
  }
}

export async function fetchCompetitions(): Promise<ExternalTournament[]> {
  try {
    const json = await fetchFromSportbex('competitions');
    if (!json || !json.data) return [];
    
    return json.data.map((c: any) => ({
      id: c.id,
      name: c.name,
      category: c.category_name || 'International',
      gender: c.gender || 'men',
      type: c.type || 'league'
    }));
  } catch (e) {
    return [];
  }
}

/**
 * Transforms raw Sportbex JSON into our unified Exchange Match schema.
 */
function transformSportbexMatch(match: any): ExternalMatch {
  const homeName = match.home_team?.name || 'TBA';
  const awayName = match.away_team?.name || 'TBA';

  const rawStatus = (match.status || 'not_started').toLowerCase();
  const matchEnded = ['finished', 'completed', 'result'].includes(rawStatus);
  const matchStarted = !['upcoming', 'scheduled', 'postponed'].includes(rawStatus);

  let status: string = 'upcoming';
  if (matchEnded) status = 'finished';
  else if (matchStarted || rawStatus === 'live' || rawStatus === 'in_play') status = 'live';

  // Sportbex usually provides direct probabilities or implicit market data
  const probabilities = {
    home: match.win_probability_home || 50,
    away: match.win_probability_away || 50,
  };
  
  return {
    id: match.id?.toString() || Math.random().toString(),
    name: `${homeName} vs ${awayName}`,
    matchType: match.match_type || 't20',
    status,
    venue: match.venue || 'Global Stadium',
    date: match.start_date || new Date().toISOString(),
    series: match.competition_name || 'International Series',
    seriesId: match.competition_id?.toString(),
    teams: [homeName, awayName],
    score: parseSportbexScore(match),
    matchStarted,
    matchEnded,
    rawStatusText: match.status_note || rawStatus,
    probabilities
  };
}

function parseSportbexScore(match: any) {
  if (!match.score_home && !match.score_away) return undefined;
  
  const scores: any[] = [];
  if (match.score_home) scores.push({ inning: match.home_team?.name || 'Home', r: match.score_home });
  if (match.score_away) scores.push({ inning: match.away_team?.name || 'Away', r: match.score_away });

  return scores.length > 0 ? scores : undefined;
}