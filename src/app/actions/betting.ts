'use client';

import { doc, setDoc, updateDoc, collection, serverTimestamp, runTransaction, Firestore, getDoc } from 'firebase/firestore';
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
    if (e.code === 'permission-denied' || e.message?.includes('permission')) {
      const permissionError = new FirestorePermissionError({
        path: betRef.path,
        operation: 'update',
      });
      errorEmitter.emit('permission-error', permissionError);
    }
  }
}

/**
 * Cancels a bet and returns a portion of the stake based on current odds.
 */
export async function cancelBetAction(db: Firestore, userId: string, betId: string) {
  const betRef = doc(db, 'users', userId, 'bets', betId);
  const userRef = doc(db, 'users', userId);

  try {
    await runTransaction(db, async (transaction) => {
      const betDoc = await transaction.get(betRef);
      if (!betDoc.exists()) throw new Error("Bet not found");
      const betData = betDoc.data();
      if (betData.status !== 'open') throw new Error("Bet is already settled");

      // Fetch current odds from the market
      const marketRef = doc(db, 'matches', betData.matchId, 'markets', betData.marketId);
      const marketDoc = await transaction.get(marketRef);
      
      let currentOdds = betData.odds;
      if (marketDoc.exists()) {
        const marketData = marketDoc.data();
        const selection = marketData.selections?.find((s: any) => s.id === betData.selectionId);
        if (selection) {
          currentOdds = selection.odds;
        }
      }

      // Calculate Cash Out Value: Original Stake * (Original Odds / Current Odds)
      // We apply a 5% margin for the "house"
      const cashOutValue = (betData.stake * (betData.odds / currentOdds)) * 0.95;

      transaction.update(betRef, { status: 'cancelled', cashOutValue });

      const userDoc = await transaction.get(userRef);
      const currentBalance = userDoc.data()?.tokenBalance || 0;
      transaction.update(userRef, {
        tokenBalance: currentBalance + cashOutValue
      });
    });
    return { success: true };
  } catch (e: any) {
    if (e.code === 'permission-denied' || e.message?.includes('permission')) {
      const permissionError = new FirestorePermissionError({
        path: betRef.path,
        operation: 'update',
      });
      errorEmitter.emit('permission-error', permissionError);
    }
    return { error: e.message };
  }
}
