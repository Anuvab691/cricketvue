'use client';

import { Firestore, doc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { fetchSgoCricketEvents } from '@/services/cricket-api-service';

/**
 * SGO v2 Data Ingestion: Fetches events and updates terminal state.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  try {
    // 1. Fetch live events from SGO v2 Pulse
    const events = await fetchSgoCricketEvents();
    const activeMatchIds = new Set<string>();

    // 2. Process and Link Data
    for (const match of events) {
      activeMatchIds.add(match.id);

      // Save to Firestore with atomic merge
      const matchRef = doc(db, 'matches', match.id);
      await setDoc(matchRef, {
        ...match,
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      // If there's a league/series, upsert the tournament
      if (match.series) {
        const tRef = doc(db, 'tournaments', match.series);
        await setDoc(tRef, {
          id: match.series,
          name: match.series,
          category: 'SGO League',
          status: 'ACTIVE',
          lastUpdated: new Date().toISOString()
        }, { merge: true });
      }
    }

    // 3. Pruning: Remove matches no longer in the live feed
    const existingSnap = await getDocs(collection(db, 'matches'));
    const batch = writeBatch(db);
    let prunedCount = 0;
    
    existingSnap.forEach(docSnap => {
      if (!activeMatchIds.has(docSnap.id)) {
        batch.delete(docSnap.ref);
        prunedCount++;
      }
    });

    if (prunedCount > 0) {
      await batch.commit();
    }

    return { 
      success: true, 
      count: activeMatchIds.size, 
      pruned: prunedCount 
    };
  } catch (error: any) {
    console.error("SGO v2 Sync Failure:", error);
    return { success: false, error: error.message };
  }
}

export async function clearAllMatchesAction(db: Firestore) {
  try {
    const querySnapshot = await getDocs(collection(db, 'matches'));
    const batch = writeBatch(db);
    querySnapshot.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
