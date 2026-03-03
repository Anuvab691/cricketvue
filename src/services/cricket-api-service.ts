'use server';

/**
 * @fileOverview Service for interacting with external Cricket Data APIs.
 * This handles fetching real-time live scores and match schedules using an API key.
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

/**
 * CONFIGURATION: The API key is pulled from environment variables.
 * Replace the value in your .env file to update it manually.
 */
const CRICKET_API_KEY = process.env.CRICKET_API_KEY || "D726oFB4PluI7d0ecane53fcZgajB7lxaHxBDrm3";
const API_BASE_URL = "https://api.cricketdata.org/v1/currentMatches";

/**
 * Fetches current real-world matches from the configured API provider.
 * Uses a low revalidation time to ensure data is fresh.
 */
export async function fetchLiveMatches(): Promise<ExternalMatch[]> {
  try {
    if (!CRICKET_API_KEY || CRICKET_API_KEY === 'YOUR_API_KEY_HERE') {
      console.warn("Cricket API Key is missing or default. Please add a valid CRICKET_API_KEY to your .env file.");
      return [];
    }

    const response = await fetch(`${API_BASE_URL}?apikey=${CRICKET_API_KEY}`, {
      next: { revalidate: 10 } // Refresh every 10 seconds for "Actual Web" speed
    });
    
    if (!response.ok) {
      throw new Error(`Cricket API Error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    
    if (json.status !== 'success' || !json.data) {
      console.warn("API returned empty or error state:", json.reason);
      return [];
    }

    // Process and normalize the data
    return json.data
      .filter((m: any) => {
        // Filter: Remove IPL and specific minor leagues for a professional look
        const name = (m.name || '').toLowerCase();
        const series = (m.series || '').toLowerCase();
        return !name.includes('ipl') && !series.includes('ipl');
      })
      .map((m: any) => ({
        id: m.id || `match-${Math.random().toString(36).substr(2, 9)}`,
        name: m.name || 'International Fixture',
        matchType: m.matchType || 't20',
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
    console.error("Critical Sync Error:", error);
    return [];
  }
}
