
'use server';

/**
 * @fileOverview Modular Server-Side Service for Cricket Data using Sportradar API (v2).
 * Handles live matches, schedules, competitions, and outrights.
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
    r: string;
    inning: string;
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

// Global Sportradar API Base
const SPORTRADAR_BASE_URL = "https://api.sportradar.com/cricket-t2/en/";

/**
 * Generic fetcher for Sportradar API with no caching for live data.
 */
async function fetchFromSportradar(endpoint: string) {
  const apiKey = process.env.CRICKET_API_KEY;
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE' || apiKey === '') {
    throw new Error("API KEY ERROR: Please add your Sportradar API Key to the environment variables.");
  }

  const cleanEndpoint = endpoint.replace(/^\//, '');
  const url = `${SPORTRADAR_BASE_URL}${cleanEndpoint}?api_key=${apiKey}`;

  try {
    console.log(`[Sportradar] Fetching: ${url.split('?')[0]}`); 
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    
    if (response.status === 401 || response.status === 403) {
      throw new Error("API AUTH ERROR: Invalid or expired API Key.");
    }

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error: any) {
    console.error(`Sportradar Fetch Error [${endpoint}]:`, error.message);
    throw error;
  }
}

export async function fetchLiveMatches(): Promise<ExternalMatch[]> {
  try {
    const json = await fetchFromSportradar('schedules/live/summaries.json');
    if (!json || !json.summaries) return [];
    return json.summaries.map(transformSportradarMatch);
  } catch (e) {
    console.error("fetchLiveMatches failed:", e);
    throw e;
  }
}

export async function fetchDailySchedule(dateString?: string): Promise<ExternalMatch[]> {
  const date = dateString || new Date().toISOString().split('T')[0];
  try {
    const json = await fetchFromSportradar(`schedules/${date}/summaries.json`);
    if (!json || !json.summaries) return [];
    return json.summaries.map(transformSportradarMatch);
  } catch (e) {
    console.error(`fetchDailySchedule failed for ${date}:`, e);
    throw e;
  }
}

/**
 * Fetches all available competitions from Sportradar.
 */
export async function fetchCompetitions(): Promise<ExternalTournament[]> {
  try {
    const json = await fetchFromSportradar('competitions.json');
    if (!json || !json.competitions) return [];
    
    return json.competitions.map((c: any) => ({
      id: c.id,
      name: c.name,
      category: c.category?.name || 'International',
      gender: c.gender || 'men',
      type: c.type || 'league'
    }));
  } catch (e) {
    console.error("fetchCompetitions failed:", e);
    throw e;
  }
}

function transformSportradarMatch(summary: any): ExternalMatch {
  const { sport_event, sport_event_status, sport_event_probabilities } = summary;
  
  const competitors = sport_event.competitors || [];
  const homeTeamObj = competitors.find((c: any) => c.qualifier === 'home') || competitors[0];
  const awayTeamObj = competitors.find((c: any) => c.qualifier === 'away') || competitors[1];

  const homeName = homeTeamObj?.name || 'TBA';
  const awayName = awayTeamObj?.name || 'TBA';

  const rawStatus = (sport_event_status?.status || 'not_started').toLowerCase();
  const matchEnded = ['ended', 'closed', 'complete', 'finished'].includes(rawStatus);
  const matchStarted = !['not_started', 'postponed', 'cancelled'].includes(rawStatus);

  let status: string = 'upcoming';
  if (matchEnded) status = 'finished';
  else if (matchStarted || rawStatus === 'live' || rawStatus === 'started') status = 'live';

  let probabilities;
  if (sport_event_probabilities?.markets) {
    const winnerMarket = sport_event_probabilities.markets.find((m: any) => m.type === 'match_winner');
    if (winnerMarket) {
      probabilities = {
        home: winnerMarket.outcomes.find((o: any) => o.name === 'home' || o.id?.includes('home'))?.probability || 50,
        away: winnerMarket.outcomes.find((o: any) => o.name === 'away' || o.id?.includes('away'))?.probability || 50,
      };
    }
  }
  
  return {
    id: sport_event.id,
    name: `${homeName} vs ${awayName}`,
    matchType: seriesToType(sport_event.sport_event_context?.competition?.name || ''),
    status,
    venue: sport_event.venue?.name || 'Global Stadium',
    date: sport_event.start_time,
    series: sport_event.sport_event_context?.competition?.name || 'International Series',
    teams: [homeName, awayName],
    score: parseSportradarScore(sport_event_status, homeName, awayName),
    matchStarted,
    matchEnded,
    rawStatusText: sport_event_status?.display_status || rawStatus,
    probabilities
  };
}

function parseSportradarScore(status: any, homeName: string, awayName: string) {
  if (!status) return undefined;
  const scores: any[] = [];
  const getCleanScore = (teamScore: any) => {
    if (!teamScore || teamScore.runs === undefined) return null;
    let text = `${teamScore.runs}/${teamScore.wickets || 0}`;
    if (teamScore.overs) text += ` (${teamScore.overs} ov)`;
    return text;
  };

  const h = getCleanScore(status.home_score);
  if (h) scores.push({ inning: homeName, r: h });
  const a = getCleanScore(status.away_score);
  if (a) scores.push({ inning: awayName, r: a });

  return scores.length > 0 ? scores : undefined;
}

function seriesToType(seriesName: string): string {
  const name = seriesName.toLowerCase();
  if (name.includes('t20') || name.includes('ipl') || name.includes('bbl')) return 't20';
  if (name.includes('test')) return 'test';
  if (name.includes('odi')) return 'odi';
  return 'international';
}
