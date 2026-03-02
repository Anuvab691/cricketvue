'use client';

import { doc, setDoc, collection, Firestore, getDocs, getDoc } from 'firebase/firestore';
import { fetchLiveMatches } from '@/services/cricket-api-service';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Syncs actual real-world cricket data into our Firestore matches collection.
 * Removed demo randomization to ensure data matches the "Actual Web".
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    const liveMatchesFromApi = await fetchLiveMatches();
    
    if (liveMatchesFromApi.length === 0) {
      return { success: true, count: 0 };
    }

    const batchPromises = liveMatchesFromApi.map(async (m) => {
      const matchRef = doc(db, 'matches', m.id);
      
      let status: 'live' | 'upcoming' | 'finished' = 'upcoming';
      if (m.matchEnded) {
        status = 'finished';
      } else if (m.matchStarted) {
        status = 'live';
      }

      // Use actual score from API without randomization
      const scoreString = (m.score && m.score.length > 0)
        ? m.score.map(s => `${s.inning}: ${s.r}/${s.w} (${s.o} ov)`).join(' | ')
        : (status === 'live' ? 'Live - Calculating...' : 'Scheduled');

      const matchData = {
        teamA: m.teams[0],
        teamB: m.teams[1],
        startTime: m.date,
        series: m.series || 'International Series',
        status: status,
        statusText: m.status,
        currentScore: scoreString,
        venue: m.venue,
        lastUpdated: new Date().toISOString()
      };

      setDoc(matchRef, matchData, { merge: true })
        .catch(async () => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: matchRef.path,
            operation: 'write',
            requestResourceData: matchData,
          }));
        });
        
      // Initialize or update markets with static/fair odds
      const marketsRef = collection(db, 'matches', m.id, 'markets');
      const marketsSnap = await getDocs(marketsRef).catch(() => null);
      
      if (marketsSnap && marketsSnap.empty) {
        const winnerMarketRef = doc(marketsRef, 'match_winner');
        const winnerData = {
          type: 'match_winner',
          status: 'open',
          selections: [
            { id: 'sel_a', name: m.teams[0], odds: 1.90 },
            { id: 'sel_b', name: m.teams[1], odds: 1.90 }
          ]
        };
        setDoc(winnerMarketRef, winnerData);

        if (status === 'live') {
          const nextBallRef = doc(marketsRef, 'next_ball');
          const nextBallData = {
            type: 'next_ball',
            status: 'open',
            selections: [
              { id: 'dot', name: 'Dot Ball', odds: 1.50 },
              { id: 'boundary', name: 'Boundary', odds: 4.50 },
              { id: 'wicket', name: 'Wicket', odds: 12.00 }
            ]
          };
          setDoc(nextBallRef, nextBallData);
        }
      }
    });

    await Promise.all(batchPromises);

    const settingsRef = doc(db, 'app_settings', 'global');
    setDoc(settingsRef, { lastGlobalSync: new Date().toISOString() }, { merge: true });

    return { success: true, count: liveMatchesFromApi.length };
  } catch (error: any) {
    return { error: error.message };
  }
}
