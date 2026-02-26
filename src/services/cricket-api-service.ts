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
}

const CRICKET_API_KEY = "D726oFB4PluI7d0ecane53fcZgajB7lxaHxBDrm3";

/**
 * Fetches current matches from cricketdata.org.
 */
export async function fetchLiveMatches(): Promise<ExternalMatch[]> {
  try {
    const response = await fetch(`https://api.cricketdata.org/v1/currentMatches?apikey=${CRICKET_API_KEY}`, {
      next: { revalidate: 60 } // Cache for 1 minute
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
      score: m.score || []
    }));
  } catch (error) {
    console.error("Cricket Data Sync Error:", error);
    return getMockMatches();
  }
}

function getMockMatches(): ExternalMatch[] {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const nextWeek = new Date(now.getTime() + 86400000 * 7);

  return [
    {
      id: "live-match-2025-1",
      name: "India vs Pakistan - Champions Trophy",
      matchType: "odi",
      status: "India needs 12 runs in 8 balls",
      venue: "Gaddafi Stadium, Lahore",
      date: now.toISOString(),
      series: "ICC Champions Trophy 2025",
      teams: ["India", "Pakistan"],
      score: [
        { r: 285, w: 4, o: 48.4, inning: "India" },
        { r: 296, w: 9, o: 50, inning: "Pakistan" }
      ]
    },
    {
      id: "live-match-2025-2",
      name: "CSK vs Mumbai Indians",
      matchType: "t20",
      status: "CSK: 145/3 (14.2 ov)",
      venue: "M. A. Chidambaram Stadium, Chennai",
      date: now.toISOString(),
      series: "IPL 2025",
      teams: ["CSK", "Mumbai Indians"],
      score: [
        { r: 145, w: 3, o: 14.2, inning: "CSK" }
      ]
    },
    {
      id: "upcoming-match-2025-1",
      name: "Australia vs England - Ashes",
      matchType: "test",
      status: "Upcoming",
      venue: "The Gabba, Brisbane",
      date: tomorrow.toISOString(),
      series: "The Ashes 2025",
      teams: ["Australia", "England"]
    },
    {
      id: "upcoming-match-2025-2",
      name: "UP Warriorz vs Delhi Capitals",
      matchType: "t20",
      status: "Upcoming",
      venue: "Arun Jaitley Stadium, Delhi",
      date: nextWeek.toISOString(),
      series: "WPL 2025",
      teams: ["UP Warriorz", "Delhi Capitals"]
    }
  ];
}
