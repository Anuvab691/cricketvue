'use client';

import { doc, setDoc, collection, Firestore, getDocs } from 'firebase/firestore';
import { fetchLiveMatches } from '@/services/cricket-api-service';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Syncs actual real-world cricket data into our Firestore matches collection.
 * This function processes raw API data into our internal Betting Match format.
 * Now processes ALL matches returned from the service without additional filtering.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    const liveMatchesFromApi = await fetchLiveMatches();
    
    if (liveMatchesFromApi.length === 0) {
      return { success: true, count: 0 };
    }

    const batchPromises = liveMatchesFromApi.map(async (m) => {
      const matchRef = doc(db, 'matches', m.id);
      
      // Determine logical status for our UI
      let status: 'live' | 'upcoming' | 'finished' = 'upcoming';
      if (m.matchEnded) {
        status = 'finished';
      } else if (m.matchStarted) {
        status = 'live';
      }

      // Format Score Array: "India 240/5 (45.2 ov) | Aus 10/0 (2 ov)"
      const scoreString = (m.score && m.score.length > 0)
        ? m.score.map(s => `${s.inning}: ${s.r}/${s.w} (${s.o} ov)`).join(' | ')
        : (status === 'live' ? 'Live - Score Updating...' : 'Scheduled');

      const matchData = {
        teamA: m.teams[0] || 'TBD',
        teamB: m.teams[1] || 'TBD',
        startTime: m.date,
        series: m.series || 'International Series',
        status: status,
        statusText: m.status,
        currentScore: scoreString,
        venue: m.venue,
        lastUpdated: new Date().toISOString()
      };

      // Atomic Update to Match Data
      setDoc(matchRef, matchData, { merge: true })
        .catch(() => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: matchRef.path,
            operation: 'write',
            requestResourceData: matchData,
          }));
        });
        
      // Ensure Betting Markets exist for this match
      const marketsRef = collection(db, 'matches', m.id, 'markets');
      const marketsSnap = await getDocs(marketsRef).catch(() => null);
      
      // Initialize Default Markets if they are missing
      if (marketsSnap && marketsSnap.empty) {
        // Standard Winner Market
        const winnerMarketRef = doc(marketsRef, 'match_winner');
        setDoc(winnerMarketRef, {
          type: 'match_winner',
          status: 'open',
          selections: [
            { id: 'sel_a', name: m.teams[0] || 'Team A', odds: 1.90 },
            { id: 'sel_b', name: m.teams[1] || 'Team B', odds: 1.90 }
          ]
        });

        // Instant Micro Markets (Next Ball) for Live Games
        if (status === 'live') {
          const nextBallRef = doc(marketsRef, 'next_ball');
          setDoc(nextBallRef, {
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

    // Global Sync Timestamp for UI synchronization
    const settingsRef = doc(db, 'app_settings', 'global');
    setDoc(settingsRef, { 
      lastGlobalSync: new Date().toISOString(),
      activeMatchesCount: liveMatchesFromApi.length 
    }, { merge: true });

    return { success: true, count: liveMatchesFromApi.length };
  } catch (error: any) {
    console.error("Sync Internal Failure:", error);
    return { error: error.message };
  }
}
