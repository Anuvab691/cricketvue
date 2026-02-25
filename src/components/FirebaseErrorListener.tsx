'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * A central listener that catches FirestorePermissionErrors emitted by the app.
 * In development, it re-throws the error so it can be captured by the Next.js error overlay,
 * providing rich context for debugging Security Rules.
 */
export function FirebaseErrorListener() {
  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      // Re-throwing allows the Next.js development overlay to display the rich error details.
      // This is essential for the agentive fixing loop.
      throw error;
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, []);

  return null;
}
