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
      // 1. READS
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) {
        throw new Error("User profile not found. Please ensure you are logged in.");
      }

      const currentBalance = userDoc.data().tokenBalance || 0;
      if (currentBalance < betData.stake) {
        throw new Error("Insufficient balance to place this bet.");
      }

      // 2. WRITES (All reads MUST come before writes)
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
      // 1. ALL READS FIRST
      const betDoc = await transaction.get(betRef);
      const userDoc = await transaction.get(userRef);

      if (!betDoc.exists()) return;
      if (betDoc.data().status !== 'open') return;

      // 2. ALL WRITES SECOND
      transaction.update(betRef, { status: result });

      if (result === 'won' && userDoc.exists()) {
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
 * Cancels a bet and returns tokens based on current odds with a 5% deduction.
 */
export async function cancelBetAction(db: Firestore, userId: string, betId: string) {
  const betRef = doc(db, 'users', userId, 'bets', betId);
  const userRef = doc(db, 'users', userId);

  try {
    await runTransaction(db, async (transaction) => {
      // 1. ALL READS FIRST (CRITICAL)
      const betDoc = await transaction.get(betRef);
      if (!betDoc.exists()) throw new Error("Bet not found");
      
      const betData = betDoc.data();
      if (betData.status !== 'open') throw new Error("Bet is already settled or cancelled");

      // We need to check if the market still exists to get live odds
      const marketRef = doc(db, 'matches', betData.matchId, 'markets', betData.marketId);
      const marketDoc = await transaction.get(marketRef);
      
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) throw new Error("User profile not found");

      // 2. COMPUTE LOGIC
      let currentOdds = betData.odds;
      if (marketDoc.exists()) {
        const marketData = marketDoc.data();
        const selection = marketData.selections?.find((s: any) => s.id === betData.selectionId);
        if (selection) {
          currentOdds = selection.odds;
        }
      }

      // Calculation: (Original Stake * (Original Odds / Current Odds)) * 0.95 (5% deduction)
      // Rounded down to nearest whole token
      const cancelValue = Math.floor((betData.stake * (betData.odds / currentOdds)) * 0.95);

      // 3. ALL WRITES SECOND
      transaction.update(betRef, { 
        status: 'cancelled', 
        returnedAmount: cancelValue,
        cancelledAt: new Date().toISOString()
      });

      const currentBalance = userDoc.data()?.tokenBalance || 0;
      transaction.update(userRef, {
        tokenBalance: currentBalance + cancelValue
      });
    });
    return { success: true };
  } catch (e: any) {
    console.error("Bet Cancellation Failed:", e);
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
