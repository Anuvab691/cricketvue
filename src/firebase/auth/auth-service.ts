'use client';

import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut, 
  Auth 
} from 'firebase/auth';
import { doc, setDoc, getDoc, getFirestore } from 'firebase/firestore';

/**
 * Signs in a user with email and password.
 */
export async function loginWithEmail(auth: Auth, email: string, pass: string) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return result.user;
  } catch (error: any) {
    console.error("Error signing in:", error.code, error.message);
    throw error;
  }
}

/**
 * Creates a new user and initializes/claims their Firestore profile.
 */
export async function signUpWithEmail(auth: Auth, email: string, pass: string) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    const db = getFirestore();
    const userRef = doc(db, 'users', result.user.uid);
    
    // Check if a profile was already created for this email by a parent (Super/Master)
    const existingDoc = await getDoc(userRef);
    
    let initialData: any = {
      username: email.split('@')[0],
      email: email,
      isActive: true,
      updatedAt: new Date().toISOString()
    };

    // Auto-assign Apex Admin role for this specific email
    if (email.toLowerCase() === 'admin@cricketvue.com') {
      initialData.role = 'admin';
    }

    // Only set default values if the document doesn't already exist
    if (!existingDoc.exists()) {
      initialData.role = initialData.role || 'customer';
      initialData.tokenBalance = 1000;
      initialData.createdAt = new Date().toISOString();
    }

    await setDoc(userRef, initialData, { merge: true });

    return result.user;
  } catch (error: any) {
    console.error("Error signing up:", error.code, error.message);
    throw error;
  }
}

/**
 * Signs out the current user.
 */
export async function logout(auth: Auth) {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
}
