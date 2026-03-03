'use client';

import { doc, setDoc, collection, Firestore, getDocs } from 'firebase/firestore';
import { fetchLiveMatches } from '@/services/cricket-api-service';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Syncs actual real-world cricket data into our Firestore matches collection.
 * This function processes raw API data into our internal Betting Match format.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    // This calls the server-side service which securely uses your API Key
    const liveMatchesFromApi = await fetchLiveMatches();
    
    if (!liveMatchesFromApi || liveMatchesFromApi.length === 0) {
      console.log("Sync Check: No matches returned from API provider.");
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

      // Format Score Array
      const scoreString = (m.score && m.score.length > 0)
        ? m.score.map(s => `${s.inning}: ${s.r}/${s.w} (${s.o} ov)`).join(' | ')
        : (status === 'live' ? 'Live - Score Updating...' : 'Scheduled');

      const matchData = {
        teamA: m.teams[0] || 'TBD',
        teamB: m.teams[1] || 'TBD',
        startTime: m.date,
        series: m.series || 'International Series',
        matchType: m.matchType || 't20', // Crucial for filtering in Match Centre
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
        const winnerMarketRef = doc(marketsRef, 'match_winner');
        setDoc(winnerMarketRef, {
          type: 'match_winner',
          status: 'open',
          selections: [
            { id: 'sel_a', name: m.teams[0] || 'Team A', odds: 1.90 },
            { id: 'sel_b', name: m.teams[1] || 'Team B', odds: 1.90 }
          ]
        });

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
