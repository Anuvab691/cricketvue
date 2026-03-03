
'use client';

import { doc, setDoc, collection, Firestore, getDocs } from 'firebase/firestore';
import { fetchLiveMatches, ExternalMatch } from '@/services/cricket-api-service';

/**
 * Syncs actual real-world cricket data into our Firestore matches collection.
 * Now comprehensive: fetches live scores and today's scheduled events.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    const matchesFromApi = await fetchLiveMatches();
    
    if (!matchesFromApi || matchesFromApi.length === 0) {
      console.log("Sync: No active or scheduled matches found.");
      return { success: true, count: 0 };
    }

    const batchPromises = matchesFromApi.map(async (m) => {
      const matchRef = doc(db, 'matches', m.id);
      
      let status: 'live' | 'upcoming' | 'finished' = 'upcoming';
      if (m.matchEnded) {
        status = 'finished';
      } else if (m.matchStarted) {
        status = 'live';
      }

      const scoreString = (m.score && m.score.length > 0)
        ? m.score.map(s => `${s.inning}: ${s.r || 0}`).join(' | ')
        : (status === 'live' ? 'Live - Score Updating...' : 'Scheduled');

      const matchData = {
        teamA: m.teams[0] || 'TBD',
        teamB: m.teams[1] || 'TBD',
        startTime: m.date,
        series: m.series || 'International Series',
        matchType: m.matchType,
        status: status,
        statusText: m.status,
        currentScore: scoreString,
        venue: m.venue,
        lastUpdated: new Date().toISOString()
      };

      await setDoc(matchRef, matchData, { merge: true });
        
      // Ensure basic markets exist for every match
      const marketsRef = collection(db, 'matches', m.id, 'markets');
      const marketsSnap = await getDocs(marketsRef).catch(() => null);
      
      if (marketsSnap && marketsSnap.empty) {
        const winnerMarketRef = doc(marketsRef, 'match_winner');
        await setDoc(winnerMarketRef, {
          type: 'match_winner',
          status: 'open',
          selections: [
            { id: 'sel_a', name: m.teams[0] || 'Team A', odds: 1.90 },
            { id: 'sel_b', name: m.teams[1] || 'Team B', odds: 1.90 }
          ]
        });

        if (status === 'live') {
          const nextBallRef = doc(marketsRef, 'next_ball');
          await setDoc(nextBallRef, {
            type: 'next_ball',
            status: 'open',
            selections: [
              { id: 'dot', name: 'Dot Ball', odds: 1.50 },
              { id: 'boundary', name: 'Boundary', odds: 4.50 },
              { id: 'wicket', name: 'Wicket', odds: 12.00 }
            ]
          });
        }
      }
    });

    await Promise.all(batchPromises);

    const settingsRef = doc(db, 'app_settings', 'global');
    await setDoc(settingsRef, { 
      lastGlobalSync: new Date().toISOString(),
      activeMatchesCount: matchesFromApi.length 
    }, { merge: true });

    return { success: true, count: matchesFromApi.length };
  } catch (error: any) {
    console.error("Sync Internal Failure:", error);
    return { error: error.message };
  }
}
