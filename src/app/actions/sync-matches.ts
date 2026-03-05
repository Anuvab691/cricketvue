
'use client';

import { Firestore, doc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { fetchLiveMatches, fetchMatchDetail } from '@/services/cricket-api-service';

/**
 * Sync Engine: Re-activated to fetch high-fidelity data from Sportbex.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    const liveMatches = await fetchLiveMatches();
    if (!liveMatches || liveMatches.length === 0) {
      console.log("Sync Engine: No live matches found on network.");
      return { success: true, count: 0 };
    }

    let syncedCount = 0;
    for (const match of liveMatches) {
      // Small delay to respect Sportbex Trial API limits (1 req/sec)
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      const detail = await fetchMatchDetail(match.id);
      const matchData = detail || match;

      const matchRef = doc(db, 'matches', match.id);
      await setDoc(matchRef, {
        teamA: matchData.teams[0] || 'TBA',
        teamB: matchData.teams[1] || 'TBA',
        startTime: matchData.date,
        status: matchData.status,
        statusText: matchData.rawStatusText || 'Live',
        currentScore: matchData.score || '0/0 (0.0 ov)',
        venue: matchData.venue,
        series: matchData.series,
        lastUpdated: new Date().toISOString(),
        odds: {
          home: { back: 1.85, lay: 1.87 },
          away: { back: 2.10, lay: 2.12 }
        }
      }, { merge: true });

      // Ensure at least one market exists for betting
      const marketRef = doc(db, 'matches', match.id, 'markets', 'match_winner');
      await setDoc(marketRef, {
        type: 'match_winner',
        status: 'open',
        selections: [
          { id: 'home', name: matchData.teams[0], odds: 1.85 },
          { id: 'away', name: matchData.teams[1], odds: 2.10 }
        ]
      }, { merge: true });

      syncedCount++;
    }

    return { success: true, count: syncedCount };
  } catch (error: any) {
    console.error("Sync Engine Failure:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Deep Purge: Clears all matches from the local database.
 */
export async function clearAllMatchesAction(db: Firestore) {
  try {
    const matchesSnap = await getDocs(collection(db, 'matches'));
    const batch = writeBatch(db);
    matchesSnap.docs.forEach(matchDoc => batch.delete(matchDoc.ref));
    await batch.commit();
    return { success: true };
  } catch (error: any) {
    console.error("Purge Engine Failure:", error);
    return { success: false, error: error.message };
  }
}
