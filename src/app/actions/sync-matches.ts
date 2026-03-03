'use client';

import { doc, setDoc, collection, Firestore, getDocs, writeBatch, getDoc } from 'firebase/firestore';

/**
 * Sync is currently DISABLED per user request.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  console.log("[Sync] Synchronization is currently disabled.");
  return { success: false, reason: 'disabled' };
}

async function updateSyncStatus(db: Firestore, status: 'success' | 'error' | 'disabled', count: number, deleted: number, errorMsg?: string) {
  const settingsRef = doc(db, 'app_settings', 'global');
  await setDoc(settingsRef, { 
    lastGlobalSync: new Date().toISOString(),
    activeMatchesCount: count,
    syncStatus: status,
    syncError: errorMsg || null,
    matchesDeletedInLastSync: deleted
  }, { merge: true });
}

/**
 * Clears all match data from Firestore.
 */
export async function clearAllMatchesAction(db: Firestore) {
  try {
    const settingsRef = doc(db, 'app_settings', 'global');
    await setDoc(settingsRef, { 
      syncStatus: 'clearing',
      lastGlobalSync: null
    }, { merge: true });

    const matchesRef = collection(db, 'matches');
    const snapshot = await getDocs(matchesRef);
    
    if (snapshot.empty) {
        await setDoc(settingsRef, { syncStatus: 'idle', activeMatchesCount: 0 }, { merge: true });
        return { success: true, count: 0 };
    }
    
    const batch = writeBatch(db);
    snapshot.docs.forEach(docSnap => {
      batch.delete(docSnap.ref);
    });
    
    await batch.commit();
    
    await setDoc(settingsRef, { 
      activeMatchesCount: 0,
      syncStatus: 'idle'
    }, { merge: true });

    return { success: true, count: snapshot.size };
  } catch (error: any) {
    console.error("Clear Terminal Error:", error);
    return { error: error.message };
  }
}
