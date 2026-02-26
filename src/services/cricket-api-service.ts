
'use server';

/**
 * @fileOverview Service for interacting with external Cricket Data APIs.
 * This handles fetching live scores and match schedules using the provided API key.
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

const CRICKET_API_KEY = "D726oFB4PluI7d0ecane53fcZgajB7lxaHxBDrm3";

/**
 * Fetches current matches from cricketdata.org.
 */
export async function fetchLiveMatches(): Promise<ExternalMatch[]> {
  try {
    const response = await fetch(`https://api.cricketdata.org/v1/currentMatches?apikey=${CRICKET_API_KEY}`, {
      next: { revalidate: 30 } // Cache for 30 seconds
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    
    if (json.status !== 'success') {
      console.warn("Cricket Data API returned non-success status:", json.reason);
      return getMockMatches();
    }

    // Map the API response to our internal ExternalMatch format
    return json.data.map((m: any) => ({
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
    return getMockMatches();
  }
}

function getMockMatches(): ExternalMatch[] {
  const now = new Date();
  
  const todayMatch = new Date(now);
  todayMatch.setHours(now.getHours() + 2);

  const tomorrowMatch = new Date(now);
  tomorrowMatch.setDate(now.getDate() + 1);
  tomorrowMatch.setHours(15, 0, 0, 0);

  return [
    {
      id: "demo-live-1",
      name: "India vs England",
      matchType: "t20",
      status: "India batting: 45/1 (5.2 ov)",
      venue: "Narendra Modi Stadium, Ahmedabad",
      date: now.toISOString(),
      series: "India vs England T20 Series",
      teams: ["India", "England"],
      score: [{ r: 45, w: 1, o: 5.2, inning: "India" }],
      matchStarted: true,
      matchEnded: false
    },
    {
      id: "demo-upcoming-1",
      name: "RCB vs MI",
      matchType: "t20",
      status: "Upcoming",
      venue: "M. Chinnaswamy Stadium, Bengaluru",
      date: todayMatch.toISOString(),
      series: "IPL 2025",
      teams: ["RCB", "MI"],
      matchStarted: false,
      matchEnded: false
    },
    {
      id: "demo-upcoming-2",
      name: "CSK vs GT",
      matchType: "t20",
      status: "Upcoming",
      venue: "M. A. Chidambaram Stadium, Chennai",
      date: tomorrowMatch.toISOString(),
      series: "IPL 2025",
      teams: ["CSK", "GT"],
      matchStarted: false,
      matchEnded: false
    }
  ];
}
