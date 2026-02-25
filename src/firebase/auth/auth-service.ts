'use client';

import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  Auth 
} from 'firebase/auth';

/**
 * Initiates Google Sign-In popup.
 */
export async function signInWithGoogle(auth: Auth) {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
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
    console.error("Error signing out", error);
    throw error;
  }
}
