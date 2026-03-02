'use client';

import { doc, setDoc, collection, Firestore, getDocs, getDoc } from 'firebase/firestore';
import { fetchLiveMatches } from '@/services/cricket-api-service';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Syncs real-world cricket data into our Firestore matches collection.
 * Includes "Demo Mode" randomization to simulate live action.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    const liveMatchesFromApi = await fetchLiveMatches();
    
    const batchPromises = liveMatchesFromApi.map(async (m) => {
      const matchRef = doc(db, 'matches', m.id);
      
      // Check if we already have this match to preserve demo data if desired
      const existingMatchSnap = await getDoc(matchRef);
      const existingData = existingMatchSnap.exists() ? existingMatchSnap.data() : null;

      let status: 'live' | 'upcoming' | 'finished' = 'upcoming';
      if (m.matchEnded) {
        status = 'finished';
      } else if (m.matchStarted) {
        status = 'live';
      }

      // --- DEMO MODE RANDOMIZATION ---
      let scoreString = (m.score && m.score.length > 0)
        ? m.score.map(s => `${s.inning}: ${s.r}/${s.w} (${s.o} ov)`).join(' | ')
        : 'TBD';

      // If the match is live, we simulate score progression
      if (status === 'live' && existingData?.currentScore && existingData.currentScore !== 'TBD') {
        const parts = existingData.currentScore.split(' | ');
        const lastInningPart = parts[parts.length - 1]; // e.g. "IND: 150/2 (15.2 ov)"
        
        // Simple regex to pull runs/wickets/overs
        const match = lastInningPart.match(/(\w+): (\d+)\/(\d+) \((\d+\.\d+) ov\)/);
        if (match) {
          const inning = match[1];
          let runs = parseInt(match[2]);
          let wickets = parseInt(match[3]);
          let overs = parseFloat(match[4]);

          // Randomly add runs (0-4)
          const runAdd = Math.floor(Math.random() * 5);
          runs += runAdd;
          
          // Randomly add a wicket (1% chance)
          if (Math.random() < 0.01 && wickets < 10) {
            wickets += 1;
          }

          // Increment ball/over (0.1 = 1 ball)
          let balls = Math.round((overs % 1) * 10) + 1;
          let mainOvers = Math.floor(overs);
          if (balls >= 6) {
            mainOvers += 1;
            balls = 0;
          }
          const newOvers = parseFloat(`${mainOvers}.${balls}`);
          
          scoreString = `${inning}: ${runs}/${wickets} (${newOvers} ov)`;
          if (parts.length > 1) {
             scoreString = parts.slice(0, -1).join(' | ') + ' | ' + scoreString;
          }
        }
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

      setDoc(matchRef, matchData, { merge: true })
        .catch(async () => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: matchRef.path,
            operation: 'write',
            requestResourceData: matchData,
          }));
        });
        
      // --- MARKET UPDATES & ODDS RANDOMIZATION ---
      const marketsRef = collection(db, 'matches', m.id, 'markets');
      const marketsSnap = await getDocs(marketsRef).catch(() => null);
      
      if (marketsSnap && !marketsSnap.empty) {
        // Fluctuating odds for demo
        marketsSnap.docs.forEach(marketDoc => {
          const marketData = marketDoc.data();
          const newSelections = marketData.selections.map((s: any) => {
            // Randomly fluctuate odds by +/- 0.05
            const change = (Math.random() * 0.1) - 0.05;
            const newOdds = Math.max(1.01, parseFloat((s.odds + change).toFixed(2)));
            return { ...s, odds: newOdds };
          });

          setDoc(marketDoc.ref, { selections: newSelections }, { merge: true });
        });
      } else if (marketsSnap && marketsSnap.empty) {
        // Initialize markets if they don't exist
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
