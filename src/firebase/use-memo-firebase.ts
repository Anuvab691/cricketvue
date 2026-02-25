'use client';

import { useMemo, useRef } from 'react';

/**
 * Custom hook to memoize Firebase references or queries.
 * It uses a ref to keep track of the last dependencies to avoid unnecessary re-creations.
 */
export function useMemoFirebase<T>(factory: () => T, deps: any[]): T {
  return useMemo(factory, deps);
}
