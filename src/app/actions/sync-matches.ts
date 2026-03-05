'use client';

import { Firestore, doc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { fetchLiveMatches, fetchMatchDetail, fetchLiveSeries } from '@/services/cricket-api-service';

/**
 * Sync Engine: Synchronizes Matches and Tournaments from the Sportbex professional feed.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    // 1. Sync Series (Tournaments)
    const seriesList = await fetchLiveSeries();
    let seriesSyncedCount = 0;
    for (const series of seriesList) {
      if (!series.id) continue;
      const seriesRef = doc(db, 'tournaments', series.id);
      await setDoc(seriesRef, {
        name: series.name,
        category: series.category,
        gender: series.gender,
        type: series.type,
        status: series.status,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      seriesSyncedCount++;
    }

    // 2. Sync Live Matches
    const liveMatches = await fetchLiveMatches();
    if (!liveMatches || liveMatches.length === 0) {
      console.log("Sync Engine: No live matches found on network scanning.");
      return { success: true, count: 0, tournamentsCount: seriesSyncedCount };
    }

    let syncedCount = 0;
    for (const match of liveMatches) {
      // Delay for Rate Limiting (1.2s between calls for Trial keys)
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      if (!match.id) continue;
      
      const detail = await fetchMatchDetail(match.id);
      const matchData = detail || match;

      const matchId = match.id;
      const matchRef = doc(db, 'matches', matchId);

      // Map Teams
      const teamA = matchData.teams[0] || 'TBA';
      const teamB = matchData.teams[1] || 'TBA';

      await setDoc(matchRef, {
        teamA: teamA,
        teamB: teamB,
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

      // Ensure Market subcollection exists for the match winner
      const marketRef = doc(db, 'matches', matchId, 'markets', 'match_winner');
      await setDoc(marketRef, {
        id: 'match_winner',
        type: 'match_winner',
        status: 'open',
        selections: [
          { id: 'home', name: teamA, odds: 1.85 },
          { id: 'away', name: teamB, odds: 2.10 }
        ]
      }, { merge: true });

      syncedCount++;
    }

    return { success: true, count: syncedCount, tournamentsCount: seriesSyncedCount };
  } catch (error: any) {
    console.error("Sync Engine Failure:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Deep Purge: Clears all matches and tournaments from the local terminal database.
 */
export async function clearAllMatchesAction(db: Firestore) {
  try {
    const matchesSnap = await getDocs(collection(db, 'matches'));
    const tournamentsSnap = await getDocs(collection(db, 'tournaments'));
    
    const batch = writeBatch(db);
    matchesSnap.docs.forEach(matchDoc => batch.delete(matchDoc.ref));
    tournamentsSnap.docs.forEach(tDoc => batch.delete(tDoc.ref));
    
    await batch.commit();
    return { success: true };
  } catch (error: any) {
    console.error("Purge Engine Failure:", error);
    return { success: false, error: error.message };
  }
}
