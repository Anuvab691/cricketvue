'use server';

/**
 * @fileOverview Service for interacting with external Cricket Data APIs.
 * This handles fetching real-time live scores and match schedules using the provided API key.
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

// Using the provided API key for Cricket Data
const CRICKET_API_KEY = "D726oFB4PluI7d0ecane53fcZgajB7lxaHxBDrm3";

/**
 * Fetches current real-world matches from cricketdata.org.
 */
export async function fetchLiveMatches(): Promise<ExternalMatch[]> {
  try {
    const response = await fetch(`https://api.cricketdata.org/v1/currentMatches?apikey=${CRICKET_API_KEY}`, {
      next: { revalidate: 15 } // Very low cache for "Actual Web" feel
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    
    if (json.status !== 'success') {
      console.warn("Cricket Data API returned non-success status:", json.reason);
      return [];
    }

    // Filter and map the API response to our internal ExternalMatch format
    return json.data
      .filter((m: any) => !m.series?.toLowerCase().includes('ipl') && !m.name?.toLowerCase().includes('ipl'))
      .map((m: any) => ({
        id: m.id || Math.random().toString(36).substr(2, 9),
        name: m.name || `${m.teams?.[0] || 'Team A'} vs ${m.teams?.[1] || 'Team B'}`,
        matchType: m.matchType || 't20',
        status: m.status || 'Scheduled',
        venue: m.venue || 'International Stadium',
        date: m.dateTimeGMT || m.date || new Date().toISOString(),
        series: m.series || 'International Series',
        teams: m.teams || ['Unknown', 'Unknown'],
        score: m.score || [],
        matchStarted: m.matchStarted || false,
        matchEnded: m.matchEnded || false
      }));
  } catch (error) {
    console.error("Cricket Data Sync Error:", error);
    return [];
  }
}
