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
      series: m.series || 'International Series', // Some matches might not have series field depending on API version
      teams: m.teams || ['Unknown', 'Unknown'],
      score: m.score || []
    }));
  } catch (error) {
    console.error("Cricket Data Sync Error:", error);
    return getMockMatches();
  }
}

function getMockMatches(): ExternalMatch[] {
  return [
    {
      id: "real-match-101",
      name: "India vs England - 5th Test",
      matchType: "test",
      status: "Stumps - Day 3",
      venue: "HPCA Stadium, Dharamshala",
      date: new Date().toISOString(),
      series: "England tour of India",
      teams: ["India", "England"],
      score: [
        { r: 477, w: 10, o: 120.1, inning: "India Inn 1" },
        { r: 218, w: 10, o: 57.4, inning: "England Inn 1" },
        { r: 103, w: 5, o: 28.0, inning: "England Inn 2" }
      ]
    },
    {
      id: "real-match-102",
      name: "RCB vs Gujarat Titans",
      matchType: "t20",
      status: "Gujarat Titans need 45 runs in 18 balls",
      venue: "M. Chinnaswamy Stadium, Bengaluru",
      series: "Indian Premier League (IPL) 2024",
      date: new Date().toISOString(),
      teams: ["RCB", "Gujarat Titans"],
      score: [
        { r: 198, w: 5, o: 20, inning: "RCB" },
        { r: 154, w: 3, o: 17, inning: "GT" }
      ]
    },
    {
      id: "real-match-upcoming-1",
      name: "Lahore Qalandars vs Islamabad United",
      matchType: "t20",
      status: "Upcoming",
      venue: "Gaddafi Stadium, Lahore",
      series: "Pakistan Super League (PSL) 2024",
      date: new Date(Date.now() + 86400000).toISOString(),
      teams: ["Lahore Qalandars", "Islamabad United"]
    },
    {
      id: "real-match-upcoming-2",
      name: "Sydney Sixers vs Brisbane Heat",
      matchType: "t20",
      status: "Upcoming",
      venue: "Sydney Cricket Ground",
      series: "Big Bash League (BBL) 13",
      date: new Date(Date.now() + 172800000).toISOString(),
      teams: ["Sydney Sixers", "Brisbane Heat"]
    }
  ];
}
