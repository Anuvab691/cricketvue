
'use client';

import { doc, setDoc, collection, Firestore, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { fetchLiveMatches } from '@/services/cricket-api-service';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Syncs real-world cricket data into our Firestore matches collection.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    const liveMatches = await fetchLiveMatches();
    
    // We update each match in Firestore
    const batchPromises = liveMatches.map(async (m) => {
      const matchRef = doc(db, 'matches', m.id);
      
      const scoreString = (m.score && m.score.length > 0)
        ? m.score.map(s => `${s.inning}: ${s.r}/${s.w} (${s.o} ov)`).join(' | ')
        : 'TBD';

      // Status determination logic based on API flags
      let status: 'live' | 'upcoming' | 'finished' = 'upcoming';
      if (m.matchEnded) {
        status = 'finished';
      } else if (m.matchStarted) {
        status = 'live';
      }

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

      // We initiate the write without await to leverage optimistic UI/caching
      setDoc(matchRef, matchData, { merge: true })
        .catch(async (serverError) => {
          const permissionError = new FirestorePermissionError({
            path: matchRef.path,
            operation: 'write',
            requestResourceData: matchData,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
        
      // Ensure markets exist
      const marketsRef = collection(db, 'matches', m.id, 'markets');
      const marketsSnap = await getDocs(marketsRef).catch(async () => {
         const permissionError = new FirestorePermissionError({
            path: marketsRef.path,
            operation: 'list',
          });
          errorEmitter.emit('permission-error', permissionError);
          return null;
      });
      
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
        setDoc(winnerMarketRef, winnerData).catch(async () => {
          const permissionError = new FirestorePermissionError({
            path: winnerMarketRef.path,
            operation: 'write',
            requestResourceData: winnerData,
          });
          errorEmitter.emit('permission-error', permissionError);
        });

        if (status === 'live') {
          const microMarketRef = doc(marketsRef, 'next_ball');
          const microData = {
            type: 'next_ball',
            status: 'open',
            selections: [
              { id: 'dot', name: 'Dot Ball', odds: 1.50 },
              { id: 'boundary', name: 'Boundary', odds: 4.50 },
              { id: 'wicket', name: 'Wicket', odds: 12.00 }
            ]
          };
          setDoc(microMarketRef, microData).catch(async () => {
            const permissionError = new FirestorePermissionError({
              path: microMarketRef.path,
              operation: 'write',
              requestResourceData: microData,
            });
            errorEmitter.emit('permission-error', permissionError);
          });
        }
      }
    });

    await Promise.all(batchPromises);

    // Track last global sync
    const settingsRef = doc(db, 'app_settings', 'global');
    setDoc(settingsRef, { lastGlobalSync: new Date().toISOString() }, { merge: true });

    return { success: true, count: liveMatches.length };
  } catch (error: any) {
    return { error: error.message };
  }
}
