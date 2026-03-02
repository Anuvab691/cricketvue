
'use client';

import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut, 
  Auth 
} from 'firebase/auth';
import { doc, setDoc, getDoc, getFirestore, deleteDoc } from 'firebase/firestore';

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
 * Handles the "Apex Admin" auto-promotion and the "Managed Profile" claim logic.
 */
export async function signUpWithEmail(auth: Auth, email: string, pass: string) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    const db = getFirestore();
    const uid = result.user.uid;
    const lowerEmail = email.toLowerCase();
    
    // Check for a pre-created profile (stored by email as ID)
    const tempRef = doc(db, 'users', lowerEmail);
    const userRef = doc(db, 'users', uid);
    
    const existingDoc = await getDoc(tempRef);
    
    let finalData: any = {
      username: email.split('@')[0],
      email: lowerEmail,
      isActive: true,
      updatedAt: new Date().toISOString()
    };

    // Rule 1: Auto-assign Apex Admin role for the specific root email
    if (lowerEmail === 'admin@cricketvue.com') {
      finalData.role = 'admin';
      finalData.tokenBalance = 0; // Admins have unlimited power, no balance needed
    }

    // Rule 2: If a profile was pre-created by a Parent (Admin/Super/Master), inherit its role/data
    if (existingDoc.exists()) {
      const preCreatedData = existingDoc.data();
      finalData = {
        ...finalData,
        ...preCreatedData,
        isPreCreated: false, // Now claimed
        updatedAt: new Date().toISOString()
      };
      
      // Migration: Delete the temporary email-based document after claiming it into the UID document
      await deleteDoc(tempRef);
    } else {
      // Rule 3: Default behavior for organic signups (not pre-created, not admin)
      if (lowerEmail !== 'admin@cricketvue.com') {
        finalData.role = 'customer';
        finalData.tokenBalance = 1000; // Welcome gift for new players
        finalData.createdAt = new Date().toISOString();
      }
    }

    await setDoc(userRef, finalData, { merge: true });

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
