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
 * Ensure you have CRICKET_API_KEY set in your .env file.
 */
const CRICKET_API_KEY = process.env.CRICKET_API_KEY;
const API_BASE_URL = "https://api.cricketdata.org/v1/currentMatches";

/**
 * Fetches current real-world matches from the configured API provider.
 * Returns ALL matches provided by the 'currentMatches' endpoint.
 */
export async function fetchLiveMatches(): Promise<ExternalMatch[]> {
  try {
    if (!CRICKET_API_KEY || CRICKET_API_KEY === 'YOUR_API_KEY_HERE' || CRICKET_API_KEY === '') {
      console.warn("Cricket API Key is missing or invalid. Please check your .env file.");
      return [];
    }

    const response = await fetch(`${API_BASE_URL}?apikey=${CRICKET_API_KEY}`, {
      next: { revalidate: 15 } // Revalidate every 15s to keep "Actual Web" speed
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const json = await response.json();
    
    if (json.status !== 'success' || !json.data) {
      return [];
    }

    // Process and normalize the data without filtering out series
    return json.data.map((m: any) => ({
      id: m.id || `match-${Math.random().toString(36).substr(2, 9)}`,
      name: m.name || 'International Match',
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
    console.error("Fetch Error:", error);
    return [];
  }
}
