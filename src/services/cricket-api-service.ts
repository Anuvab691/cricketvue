'use server';

/**
 * @fileOverview Service for interacting with external Cricket Data APIs.
 * This handles fetching live scores and match schedules.
 */

export interface ExternalMatch {
  id: string;
  name: string;
  matchType: string;
  status: string;
  venue: string;
  date: string;
  teams: string[];
  score?: Array<{
    r: number;
    w: number;
    o: number;
    inning: string;
  }>;
}

/**
 * Fetches current matches from a cricket data provider.
 * Note: In a production environment, you would use an API key from a provider like 
 * cricketdata.org or sportmonks.com.
 */
export async function fetchLiveMatches(): Promise<ExternalMatch[]> {
  try {
    // This is a placeholder for a real API call. 
    // Example: const res = await fetch(`https://api.cricketdata.org/v1/currentMatches?apikey=${process.env.CRICKET_API_KEY}`);
    
    // For this prototype, we'll simulate the "Real API" response structure 
    // to show how the data mapping works.
    const mockApiResponse = [
      {
        id: "real-match-1",
        name: "India vs Australia - 3rd Test",
        matchType: "test",
        status: "Match in progress",
        venue: "Narendra Modi Stadium, Ahmedabad",
        date: new Date().toISOString(),
        teams: ["India", "Australia"],
        score: [
          { r: 345, w: 8, o: 92.4, inning: "India Inning 1" },
          { r: 120, w: 2, o: 40.0, inning: "Australia Inning 1" }
        ]
      },
      {
        id: "real-match-2",
        name: "IPL: Mumbai Indians vs Chennai Super Kings",
        matchType: "t20",
        status: "Upcoming",
        venue: "Wankhede Stadium, Mumbai",
        date: new Date(Date.now() + 86400000).toISOString(),
        teams: ["Mumbai Indians", "Chennai Super Kings"],
      },
      {
        id: "real-match-3",
        name: "Pakistan vs New Zealand - 2nd ODI",
        matchType: "odi",
        status: "New Zealand won by 5 wickets",
        venue: "Rawalpindi Cricket Stadium",
        date: new Date(Date.now() - 3600000).toISOString(),
        teams: ["Pakistan", "New Zealand"],
        score: [
          { r: 280, w: 10, o: 49.2, inning: "Pakistan Inning 1" },
          { r: 281, w: 5, o: 48.1, inning: "New Zealand Inning 1" }
        ]
      }
    ];

    return mockApiResponse;
  } catch (error) {
    console.error("Failed to fetch cricket data:", error);
    return [];
  }
}
