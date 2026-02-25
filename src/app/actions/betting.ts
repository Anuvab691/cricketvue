
'use client';

import { doc, setDoc, updateDoc, collection, serverTimestamp, runTransaction, Firestore } from 'firebase/firestore';
import { generateMatchInsight } from '@/ai/flows/ai-match-insights';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export async function placeBetAction(db: Firestore, userId: string, betData: any) {
  const userRef = doc(db, 'users', userId);
  const betRef = doc(collection(db, 'users', userId, 'bets'));

  try {
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) {
        throw new Error("User profile not found");
      }

      const currentBalance = userDoc.data().tokenBalance || 0;
      if (currentBalance < betData.stake) {
        throw new Error("Insufficient balance");
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
    const permissionError = new FirestorePermissionError({
      path: betRef.path,
      operation: 'create',
      requestResourceData: betData,
    });
    errorEmitter.emit('permission-error', permissionError);
    return { error: e.message };
  }
}

export async function getAiInsight(teamA: string, teamB: string, status: string) {
  return await generateMatchInsight({ teamA, teamB, matchStatus: status });
}

export async function settleMockBet(db: Firestore, userId: string, betId: string, result: 'won' | 'lost', potentialWin: number) {
  const betRef = doc(db, 'users', userId, 'bets', betId);
  const userRef = doc(db, 'users', userId);

  try {
    await runTransaction(db, async (transaction) => {
      const betDoc = await transaction.get(betRef);
      if (!betDoc.exists()) return;
      if (betDoc.data().status !== 'open') return;

      transaction.update(betRef, { status: result });

      if (result === 'won') {
        const userDoc = await transaction.get(userRef);
        const currentBalance = userDoc.data()?.tokenBalance || 0;
        transaction.update(userRef, {
          tokenBalance: currentBalance + potentialWin
        });
      }
    });
  } catch (e: any) {
    const permissionError = new FirestorePermissionError({
      path: betRef.path,
      operation: 'update',
    });
    errorEmitter.emit('permission-error', permissionError);
  }
}
