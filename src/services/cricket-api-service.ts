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
 * Uses an API key from an environment variable if available.
 */
export async function fetchLiveMatches(): Promise<ExternalMatch[]> {
  const apiKey = process.env.CRICKET_API_KEY;

  try {
    // IF AN API KEY IS PROVIDED, FETCH REAL DATA
    if (apiKey && apiKey !== 'placeholder') {
      const response = await fetch(`https://api.cricketdata.org/v1/currentMatches?apikey=${apiKey}`);
      const json = await response.json();
      
      if (json.status !== 'success') {
        throw new Error(json.reason || 'Failed to fetch from real API');
      }

      // Map the API response to our internal ExternalMatch format
      return json.data.map((m: any) => ({
        id: m.id,
        name: m.name,
        matchType: m.matchType,
        status: m.status,
        venue: m.venue,
        date: m.date,
        teams: m.teams,
        score: m.score // Most providers return scores in a similar structure
      }));
    }

    // FALLBACK: HIGH-FIDELITY SIMULATED REAL MATCHES
    // This allows you to test the UI with "real-looking" data before adding a key.
    const mockApiResponse: ExternalMatch[] = [
      {
        id: "real-match-101",
        name: "India vs England - 5th Test",
        matchType: "test",
        status: "Stumps - Day 3",
        venue: "HPCA Stadium, Dharamshala",
        date: new Date().toISOString(),
        teams: ["India", "England"],
        score: [
          { r: 477, w: 10, o: 120.1, inning: "India Inn 1" },
          { r: 218, w: 10, o: 57.4, inning: "England Inn 1" },
          { r: 103, w: 5, o: 28.0, inning: "England Inn 2" }
        ]
      },
      {
        id: "real-match-102",
        name: "IPL: Royal Challengers Bangalore vs Gujarat Titans",
        matchType: "t20",
        status: "Gujarat Titans need 45 runs in 18 balls",
        venue: "M. Chinnaswamy Stadium, Bengaluru",
        date: new Date().toISOString(),
        teams: ["RCB", "Gujarat Titans"],
        score: [
          { r: 198, w: 5, o: 20, inning: "RCB" },
          { r: 154, w: 3, o: 17, inning: "GT" }
        ]
      },
      {
        id: "real-match-103",
        name: "Australia vs New Zealand - 2nd Test",
        matchType: "test",
        status: "Upcoming - Starts Tomorrow",
        venue: "Hagley Oval, Christchurch",
        date: new Date(Date.now() + 86400000).toISOString(),
        teams: ["Australia", "New Zealand"],
      }
    ];

    return mockApiResponse;
  } catch (error) {
    console.error("Cricket Data Sync Error:", error);
    return [];
  }
}
