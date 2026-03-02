'use client';

import { doc, setDoc, updateDoc, runTransaction, Firestore, collection, query, where, getDocs } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Creates a sub-account in Firestore. 
 * Parent roles create these "pre-auth" profiles. Users then "claim" them by signing up with the same email.
 */
export async function createSubAccountAction(
  db: Firestore, 
  parentId: string, 
  childData: { username: string, email: string, role: 'super' | 'master' | 'customer' }
) {
  // Use lowercase email as the temporary document ID for pre-claiming
  const lowerEmail = childData.email.toLowerCase();
  const userRef = doc(db, 'users', lowerEmail);

  try {
    await setDoc(userRef, {
      ...childData,
      email: lowerEmail,
      parentId,
      tokenBalance: 0,
      isActive: true,
      isPreCreated: true, // Flag to indicate this is a managed account awaiting claim
      createdAt: new Date().toISOString()
    });
    return { success: true };
  } catch (e: any) {
    const permissionError = new FirestorePermissionError({
      path: userRef.path,
      operation: 'create',
      requestResourceData: childData,
    });
    errorEmitter.emit('permission-error', permissionError);
    return { error: e.message };
  }
}

/**
 * Transfers tokens from a parent to a child.
 * Admin has unlimited tokens (doesn't check balance).
 */
export async function transferTokensAction(
  db: Firestore,
  fromId: string,
  toId: string,
  amount: number,
  isApex: boolean = false
) {
  const fromRef = doc(db, 'users', fromId);
  const toRef = doc(db, 'users', toId);

  try {
    await runTransaction(db, async (transaction) => {
      const fromDoc = await transaction.get(fromRef);
      const toDoc = await transaction.get(toRef);

      if (!toDoc.exists()) throw new Error("Recipient profile not found in network.");

      if (!isApex) {
        if (!fromDoc.exists()) throw new Error("Sender profile not found.");
        const currentBalance = fromDoc.data().tokenBalance || 0;
        if (currentBalance < amount) throw new Error("Insufficient balance.");

        transaction.update(fromRef, {
          tokenBalance: currentBalance - amount
        });
      }

      const targetBalance = toDoc.data().tokenBalance || 0;
      transaction.update(toRef, {
        tokenBalance: targetBalance + amount
      });
    });

    return { success: true };
  } catch (e: any) {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: toRef.path,
      operation: 'update',
    }));
    return { error: e.message };
  }
}

/**
 * Deducts tokens from a child and returns them to the parent.
 */
export async function deductTokensAction(
  db: Firestore,
  parentId: string,
  childId: string,
  amount: number,
  isApex: boolean = false
) {
  const parentRef = doc(db, 'users', parentId);
  const childRef = doc(db, 'users', childId);

  try {
    await runTransaction(db, async (transaction) => {
      const parentDoc = await transaction.get(parentRef);
      const childDoc = await transaction.get(childRef);

      if (!childDoc.exists()) throw new Error("Target sub-account not found.");
      
      const childBalance = childDoc.data().tokenBalance || 0;
      if (childBalance < amount) throw new Error("Sub-account has insufficient balance to deduct this amount.");

      // 1. Deduct from child
      transaction.update(childRef, {
        tokenBalance: childBalance - amount
      });

      // 2. Add back to parent (unless Apex Admin who has infinite pool)
      if (!isApex) {
        if (!parentDoc.exists()) throw new Error("Parent profile not found.");
        const parentBalance = parentDoc.data().tokenBalance || 0;
        transaction.update(parentRef, {
          tokenBalance: parentBalance + amount
        });
      }
    });

    return { success: true };
  } catch (e: any) {
    errorEmitter.emit('permission-error', new FirestorePermissionError({
      path: childRef.path,
      operation: 'update',
    }));
    return { error: e.message };
  }
}
