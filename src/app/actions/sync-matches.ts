
'use client';

import { doc, setDoc, collection, Firestore, getDocs } from 'firebase/firestore';
import { fetchLiveMatches, fetchDailySchedule, ExternalMatch } from '@/services/cricket-api-service';

/**
 * Syncs actual real-world cricket data from Sportradar into our Firestore matches collection.
 * Merges live matches with today's scheduled matches.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    const [liveMatches, scheduledMatches] = await Promise.all([
      fetchLiveMatches(),
      fetchDailySchedule()
    ]);

    // Merge matches, prioritizing live ones for the same ID
    const matchMap = new Map<string, ExternalMatch>();
    [...scheduledMatches, ...liveMatches].forEach(m => matchMap.set(m.id, m));
    
    const allMatches = Array.from(matchMap.values());
    
    if (allMatches.length === 0) {
      console.log("Sync: No matches found for today.");
      return { success: true, count: 0 };
    }

    const batchPromises = allMatches.map(async (m) => {
      // Clean ID for Firestore (Sportradar IDs look like sr:sport_event:12345)
      const safeId = m.id.replace(/:/g, '_');
      const matchRef = doc(db, 'matches', safeId);
      
      let status: 'live' | 'upcoming' | 'finished' = 'upcoming';
      if (m.matchEnded) {
        status = 'finished';
      } else if (m.matchStarted) {
        status = 'live';
      }

      const scoreString = m.score 
        ? m.score.map(s => `${s.inning}: ${s.r}`).join(' | ')
        : (status === 'live' ? 'Live - Score Updating...' : 'Scheduled');

      const matchData = {
        teamA: m.teams[0],
        teamB: m.teams[1],
        startTime: m.date,
        series: m.series,
        matchType: m.matchType,
        status: status,
        statusText: m.status,
        currentScore: scoreString,
        venue: m.venue,
        lastUpdated: new Date().toISOString()
      };

      await setDoc(matchRef, matchData, { merge: true });
        
      // Ensure basic markets exist
      const marketsRef = collection(db, 'matches', safeId, 'markets');
      const marketsSnap = await getDocs(marketsRef).catch(() => null);
      
      if (marketsSnap && marketsSnap.empty) {
        const winnerMarketRef = doc(marketsRef, 'match_winner');
        await setDoc(winnerMarketRef, {
          type: 'match_winner',
          status: 'open',
          selections: [
            { id: 'sel_a', name: m.teams[0], odds: 1.90 },
            { id: 'sel_b', name: m.teams[1], odds: 1.90 }
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
      activeMatchesCount: allMatches.length 
    }, { merge: true });

    return { success: true, count: allMatches.length };
  } catch (error: any) {
    console.error("Sync Internal Failure:", error);
    return { error: error.message };
  }
}
