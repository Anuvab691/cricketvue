
'use server';

/**
 * @fileOverview Modular Server-Side Service for Cricket Data using Sportradar API.
 * Handles live matches, schedules, and competition info.
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

const SPORTRADAR_BASE_URL = "https://api.sportradar.com/cricket-t2/en/";

/**
 * Generic fetcher for Sportradar API.
 */
async function fetchFromSportradar(endpoint: string) {
  const apiKey = process.env.CRICKET_API_KEY;
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE' || apiKey === '') {
    console.warn("Sportradar Secure Check: API Key is missing.");
    return null;
  }

  const url = `${SPORTRADAR_BASE_URL}${endpoint}?api_key=${apiKey}`;

  try {
    const response = await fetch(url, {
      next: { revalidate: 15 } // Cache for 15 seconds to respect rate limits
    });
    
    if (!response.ok) {
      if (response.status === 429) {
        console.warn("Sportradar API: Rate limit exceeded.");
      }
      throw new Error(`Sportradar API Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Sportradar Fetch Error [${endpoint}]:`, error);
    return null;
  }
}

/**
 * Fetches current real-time live matches from Sportradar.
 */
export async function fetchLiveMatches(): Promise<ExternalMatch[]> {
  // Provided URL: https://api.sportradar.com/cricket-t2/en/matches/live.json
  const json = await fetchFromSportradar('matches/live.json');
  if (!json || !json.summaries) return [];

  return json.summaries.map(transformSportradarMatch);
}

/**
 * Fetches today's full schedule from Sportradar.
 */
export async function fetchDailySchedule(): Promise<ExternalMatch[]> {
  const today = new Date().toISOString().split('T')[0];
  const json = await fetchFromSportradar(`schedules/${today}/summaries.json`);
  if (!json || !json.summaries) return [];

  return json.summaries.map(transformSportradarMatch);
}

/**
 * Normalizes Sportradar summary object to our InternalMatch interface.
 */
function transformSportradarMatch(summary: any): ExternalMatch {
  const { sport_event, sport_event_status } = summary;
  const competitors = sport_event.competitors || [];
  const homeTeam = competitors.find((c: any) => c.qualifier === 'home') || competitors[0];
  const awayTeam = competitors.find((c: any) => c.qualifier === 'away') || competitors[1];

  const matchStatus = sport_event_status?.match_status || 'not_started';
  
  return {
    id: sport_event.id,
    name: `${homeTeam?.name || 'TBD'} vs ${awayTeam?.name || 'TBD'}`,
    matchType: normalizeMatchType(sport_event.sport_event_context?.competition?.name || ''),
    status: matchStatus,
    venue: sport_event.venue?.name || 'Global Stadium',
    date: sport_event.start_time,
    series: sport_event.sport_event_context?.competition?.name || 'International Series',
    teams: [homeTeam?.name || 'Home', awayTeam?.name || 'Away'],
    score: parseSportradarScore(sport_event_status, homeTeam, awayTeam),
    matchStarted: matchStatus !== 'not_started' && matchStatus !== 'postponed' && matchStatus !== 'cancelled',
    matchEnded: matchStatus === 'ended' || matchStatus === 'closed'
  };
}

function normalizeMatchType(seriesName: string): string {
  const name = seriesName.toLowerCase();
  if (name.includes('t20') || name.includes('t-20')) return 't20';
  if (name.includes('test')) return 'test';
  if (name.includes('odi') || name.includes('one day')) return 'odi';
  return 'international';
}

function parseSportradarScore(status: any, home: any, away: any) {
  if (!status) return undefined;
  
  // Sportradar display_score usually looks like "150/5 & 20/0"
  const scores = [];
  if (status.home_score) {
    scores.push({ inning: home.name, r: status.home_score.display_score || 0, w: 0, o: 0 });
  }
  if (status.away_score) {
    scores.push({ inning: away.name, r: status.away_score.display_score || 0, w: 0, o: 0 });
  }
  
  return scores.length > 0 ? scores : undefined;
}
