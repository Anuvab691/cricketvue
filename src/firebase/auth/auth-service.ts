'use client';

import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut, 
  Auth 
} from 'firebase/auth';
import { doc, setDoc, getFirestore } from 'firebase/firestore';

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
 * Creates a new user with email and password and initializes their Firestore profile.
 */
export async function signUpWithEmail(auth: Auth, email: string, pass: string) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    const db = getFirestore();
    
    // Initialize user profile with default balance
    await setDoc(doc(db, 'users', result.user.uid), {
      username: email.split('@')[0],
      tokenBalance: 1000,
      isActive: true,
      createdAt: new Date().toISOString()
    }, { merge: true });

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
