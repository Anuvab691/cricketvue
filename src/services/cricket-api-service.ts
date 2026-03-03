'use server';

/**
 * @fileOverview Modular Server-Side Service for Cricket Data using Sportradar API (v2).
 * Handles live matches, schedules, and competition info with robust parsing.
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
}

const SPORTRADAR_BASE_URL = "https://api.sportradar.com";

/**
 * Generic fetcher for Sportradar API.
 */
async function fetchFromSportradar(endpoint: string) {
  const apiKey = process.env.CRICKET_API_KEY;
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE' || apiKey === '') {
    console.warn("Sportradar Secure Check: API Key is missing.");
    return null;
  }

  // Ensure endpoint is clean and use the correct Sportradar path structure
  const cleanEndpoint = endpoint.replace(/^\//, '');
  const url = `${SPORTRADAR_BASE_URL}/${cleanEndpoint}?api_key=${apiKey}`;

  try {
    const response = await fetch(url, {
      next: { revalidate: 10 } // Cache for 10 seconds
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Sportradar API Error: ${response.status}`, errorBody);
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
  const json = await fetchFromSportradar('cricket-t2/en/matches/live.json');
  if (!json || !json.summaries) return [];
  return json.summaries.map(transformSportradarMatch);
}

/**
 * Fetches a specific day's schedule from Sportradar.
 * @param dateString YYYY-MM-DD format. Defaults to today.
 */
export async function fetchDailySchedule(dateString?: string): Promise<ExternalMatch[]> {
  const date = dateString || new Date().toISOString().split('T')[0];
  const json = await fetchFromSportradar(`cricket-t2/en/schedules/${date}/summaries.json`);
  if (!json || !json.summaries) return [];
  return json.summaries.map(transformSportradarMatch);
}

/**
 * Normalizes Sportradar summary object to our ExternalMatch interface.
 */
function transformSportradarMatch(summary: any): ExternalMatch {
  const { sport_event, sport_event_status } = summary;
  
  const competitors = sport_event.competitors || [];
  const homeTeamObj = competitors.find((c: any) => c.qualifier === 'home') || competitors[0];
  const awayTeamObj = competitors.find((c: any) => c.qualifier === 'away') || competitors[1];

  const homeName = homeTeamObj?.name || 'Team A';
  const awayName = awayTeamObj?.name || 'Team B';

  const matchStatus = sport_event_status?.match_status || 'not_started';
  
  return {
    id: sport_event.id,
    name: `${homeName} vs ${awayName}`,
    matchType: normalizeMatchType(sport_event.sport_event_context?.competition?.name || ''),
    status: matchStatus,
    venue: sport_event.venue?.name || 'Global Stadium',
    date: sport_event.start_time,
    series: sport_event.sport_event_context?.competition?.name || 'International Series',
    teams: [homeName, awayName],
    score: parseSportradarScore(sport_event_status, homeName, awayName),
    matchStarted: !['not_started', 'postponed', 'cancelled'].includes(matchStatus),
    matchEnded: ['ended', 'closed', 'complete'].includes(matchStatus),
    rawStatusText: sport_event_status?.display_status || matchStatus
  };
}

function parseSportradarScore(status: any, homeName: string, awayName: string) {
  if (!status) return undefined;
  const scores: any[] = [];
  if (status.home_score?.display_score) scores.push({ inning: homeName, r: status.home_score.display_score });
  if (status.away_score?.display_score) scores.push({ inning: awayName, r: status.away_score.display_score });
  if (scores.length === 0 && status.display_score) scores.push({ inning: 'Match', r: status.display_score });
  return scores.length > 0 ? scores : undefined;
}

function normalizeMatchType(seriesName: string): string {
  const name = seriesName.toLowerCase();
  if (name.includes('t20') || name.includes('ipl') || name.includes('bbl')) return 't20';
  if (name.includes('test')) return 'test';
  if (name.includes('odi') || name.includes('one day')) return 'odi';
  return 'international';
}
