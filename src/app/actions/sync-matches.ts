'use client';

import { Firestore } from 'firebase/firestore';

/**
 * Sync Engine: SUSPENDED BY USER REQUEST.
 * This function is currently neutered and will not fetch or update any data.
 */
export async function syncCricketMatchesAction(db: Firestore) {
  console.log("Sync Engine: Suspended. No data will be fetched.");
  return { success: false, reason: 'suspended' };
}

/**
 * Deep Purge: SUSPENDED BY USER REQUEST.
 */
export async function clearAllMatchesAction(db: Firestore) {
  console.log("Purge Engine: Suspended.");
  return { success: false, reason: 'suspended' };
}
