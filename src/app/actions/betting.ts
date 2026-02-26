'use client';

import { doc, setDoc, updateDoc, collection, serverTimestamp, runTransaction, Firestore } from 'firebase/firestore';
import { generateMatchInsight } from '@/ai/flows/ai-match-insights';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Places a bet for a user and deducts the stake from their balance atomically.
 */
export async function placeBetAction(db: Firestore, userId: string, betData: any) {
  const userRef = doc(db, 'users', userId);
  const betRef = doc(collection(db, 'users', userId, 'bets'));

  try {
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) {
        throw new Error("User profile not found. Please ensure you are logged in.");
      }

      const currentBalance = userDoc.data().tokenBalance || 0;
      if (currentBalance < betData.stake) {
        throw new Error("Insufficient balance to place this bet.");
      }

      transaction.update(userRef, {
        tokenBalance: currentBalance - betData.stake
      });

      transaction.set(betRef, {
        ...betData,
        status: 'open',
        createdAt: new Date().toISOString()
      });
    });

    return { success: true };
  } catch (e: any) {
    // If it's a permission error, emit it for the global listener
    if (e.code === 'permission-denied' || e.message?.includes('permission')) {
      const permissionError = new FirestorePermissionError({
        path: betRef.path,
        operation: 'create',
        requestResourceData: betData,
      });
      errorEmitter.emit('permission-error', permissionError);
    }
    return { error: e.message };
  }
}

export async function getAiInsight(teamA: string, teamB: string, status: string) {
  return await generateMatchInsight({ teamA, teamB, matchStatus: status });
}

/**
 * Settles a bet as won or lost and updates the user's balance if they won.
 */
export async function settleMockBet(db: Firestore, userId: string, betId: string, result: 'won' | 'lost', potentialWin: number) {
  const betRef = doc(db, 'users', userId, 'bets', betId);
  const userRef = doc(db, 'users', userId);

  try {
    await runTransaction(db, async (transaction) => {
      const betDoc = await transaction.get(betRef);
      if (!betDoc.exists()) return;
      if (betDoc.data().status !== 'open') return;

      // Update the bet status
      transaction.update(betRef, { status: result });

      // If they won, add the potential win to their balance
      if (result === 'won') {
        const userDoc = await transaction.get(userRef);
        const currentBalance = userDoc.data()?.tokenBalance || 0;
        transaction.update(userRef, {
          tokenBalance: currentBalance + potentialWin
        });
      }
    });
  } catch (e: any) {
    // Check for permission errors specifically
    if (e.code === 'permission-denied' || e.message?.includes('permission')) {
      const permissionError = new FirestorePermissionError({
        path: betRef.path,
        operation: 'update',
      });
      errorEmitter.emit('permission-error', permissionError);
    }
  }
}
