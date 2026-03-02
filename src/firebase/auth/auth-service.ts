
'use client';

import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut, 
  Auth 
} from 'firebase/auth';
import { doc, setDoc, getDoc, Firestore, deleteDoc } from 'firebase/firestore';

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
export async function signUpWithEmail(auth: Auth, db: Firestore, email: string, pass: string) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    const uid = result.user.uid;
    const lowerEmail = email.toLowerCase();
    
    // Check for a pre-created profile (stored by email as ID)
    const tempRef = doc(db, 'users', lowerEmail);
    const userRef = doc(db, 'users', uid);
    
    // Explicitly check for the pre-created profile BEFORE setting defaults
    const existingDoc = await getDoc(tempRef);
    const hasPreCreated = existingDoc.exists();
    
    let finalData: any = {
      uid,
      username: email.split('@')[0],
      email: lowerEmail,
      isActive: true,
      updatedAt: new Date().toISOString()
    };

    // Rule 1: Auto-assign Apex Admin role for the specific root email
    if (lowerEmail === 'admin@cricketvue.com') {
      finalData.role = 'admin';
      finalData.tokenBalance = 0; 
      finalData.isApex = true;
    } 
    // Rule 2: If a profile was pre-created by a Parent, inherit its role/data
    else if (hasPreCreated) {
      const preCreatedData = existingDoc.data();
      finalData = {
        ...finalData,
        ...preCreatedData,
        isPreCreated: false, // Now claimed
        updatedAt: new Date().toISOString()
      };
      
      // Clean up the temporary email-based document
      await deleteDoc(tempRef);
    } 
    // Rule 3: Default behavior for organic signups
    else {
      finalData.role = 'customer';
      finalData.tokenBalance = 1000;
      finalData.createdAt = new Date().toISOString();
    }

    // Save the finalized profile to the UID-indexed document
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
