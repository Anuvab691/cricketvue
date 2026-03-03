
'use server';

/**
 * @fileOverview Secure Server-Side Service for Cricket Data.
 * 
 * This service is designed to be flexible. It primarily uses CricketData.org 
 * for live scores but is optimized to fetch a broad range of matches.
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

const CRICKET_API_KEY = process.env.CRICKET_API_KEY;
const API_BASE_URL = "https://api.cricketdata.org/v1/currentMatches";

/**
 * Fetches current real-world matches from the configured API provider.
 * This runs EXCLUSIVELY on the server.
 */
export async function fetchLiveMatches(): Promise<ExternalMatch[]> {
  try {
    if (!CRICKET_API_KEY || CRICKET_API_KEY === 'YOUR_API_KEY_HERE' || CRICKET_API_KEY === '') {
      console.warn("Secure Check: Cricket API Key is missing in environment.");
      return [];
    }

    // We fetch current matches which includes a wide variety of series
    const response = await fetch(`${API_BASE_URL}?apikey=${CRICKET_API_KEY}`, {
      next: { revalidate: 15 }
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const json = await response.json();
    
    if (json.status !== 'success' || !json.data) {
      return [];
    }

    return json.data.map((m: any) => ({
      id: m.id || `match-${Math.random().toString(36).substr(2, 9)}`,
      name: m.name || 'International Match',
      matchType: (m.matchType || 't20').toLowerCase(),
      status: m.status || 'Scheduled',
      venue: m.venue || 'Global Stadium',
      date: m.dateTimeGMT || m.date || new Date().toISOString(),
      series: m.series || 'International Series',
      teams: m.teams || ['Team A', 'Team B'],
      score: m.score || [],
      matchStarted: m.matchStarted || false,
      matchEnded: m.matchEnded || false
    }));
  } catch (error) {
    console.error("Secure Data Fetch Failure:", error);
    return [];
  }
}
