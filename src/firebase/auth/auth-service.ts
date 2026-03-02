'use client';

import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut, 
  Auth 
} from 'firebase/auth';
import { doc, setDoc, getDoc, Firestore, deleteDoc } from 'firebase/firestore';

/**
 * Handles the unified access flow. 
 * Tries to sign in; if the user doesn't exist, it checks if they are authorized (Admin or Pre-created) 
 * and signs them up automatically.
 */
export async function accessSystem(auth: Auth, db: Firestore, email: string, pass: string) {
  const lowerEmail = email.toLowerCase();
  
  try {
    // 1. Attempt standard login
    const result = await signInWithEmailAndPassword(auth, lowerEmail, pass);
    return result.user;
  } catch (error: any) {
    // 2. If user doesn't exist in Auth, check if they are authorized to join
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
      
      // Check Firestore for a pre-created profile or if it's the Apex Admin
      const isApex = lowerEmail === 'admin@cricketvue.com';
      const tempRef = doc(db, 'users', lowerEmail);
      const existingDoc = await getDoc(tempRef);
      const isAuthorized = isApex || existingDoc.exists();

      if (!isAuthorized) {
        throw new Error("Access Denied: Your email is not authorized in this network. Please contact your manager.");
      }

      // 3. Perform the "Claim" signup
      return await signUpAndClaim(auth, db, lowerEmail, pass, existingDoc.exists() ? existingDoc.data() : null);
    }
    
    throw error;
  }
}

/**
 * Internal helper to create the auth user and sync the Firestore profile.
 */
async function signUpAndClaim(auth: Auth, db: Firestore, email: string, pass: string, preCreatedData: any) {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  const uid = result.user.uid;
  const userRef = doc(db, 'users', uid);
  
  let finalData: any = {
    uid,
    username: email.split('@')[0],
    email: email,
    isActive: true,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  // Apex Admin Logic
  if (email === 'admin@cricketvue.com') {
    finalData.role = 'admin';
    finalData.tokenBalance = 0;
    finalData.isApex = true;
  } 
  // Managed Role Logic
  else if (preCreatedData) {
    finalData = {
      ...finalData,
      ...preCreatedData,
      isPreCreated: false, // Now claimed
    };
    // Clean up the temporary email-based document
    await deleteDoc(doc(db, 'users', email));
  }

  await setDoc(userRef, finalData, { merge: true });
  return result.user;
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
