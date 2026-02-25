'use client';

import { doc, setDoc, collection, Firestore, getDocs, deleteDoc } from 'firebase/firestore';
import { fetchLiveMatches, ExternalMatch } from '@/services/cricket-api-service';
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
      
      const scoreString = m.score 
        ? m.score.map(s => `${s.inning}: ${s.r}/${s.w} (${s.o} ov)`).join(' | ')
        : 'TBD';

      const matchData = {
        teamA: m.teams[0],
        teamB: m.teams[1],
        startTime: m.date,
        status: m.status.toLowerCase().includes('progress') ? 'live' : 
                m.status.toLowerCase().includes('upcoming') ? 'upcoming' : 'finished',
        currentScore: scoreString,
        venue: m.venue
      };

      // We initiate the write
      setDoc(matchRef, matchData, { merge: true })
        .catch(async (serverError) => {
          const permissionError = new FirestorePermissionError({
            path: matchRef.path,
            operation: 'write',
            requestResourceData: matchData,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
        
      // Also ensure markets exist for these matches if they are new
      const marketsRef = collection(db, 'matches', m.id, 'markets');
      const marketsSnap = await getDocs(marketsRef);
      
      if (marketsSnap.empty) {
        const winnerMarketRef = doc(marketsRef, 'match_winner');
        const winnerData = {
          type: 'match_winner',
          status: 'open',
          selections: [
            { id: 'sel_a', name: m.teams[0], odds: 1.90 },
            { id: 'sel_b', name: m.teams[1], odds: 1.90 }
          ]
        };
        setDoc(winnerMarketRef, winnerData).catch(() => {});

        if (matchData.status === 'live') {
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
          setDoc(microMarketRef, microData).catch(() => {});
        }
      }
    });

    await Promise.all(batchPromises);
    return { success: true, count: liveMatches.length };
  } catch (error: any) {
    return { error: error.message };
  }
}
