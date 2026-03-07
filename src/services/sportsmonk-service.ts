'use server';

/**
 * @fileOverview DEPRECATED.
 * This service has been replaced by the Sportbex API integration in cricket-api-service.ts.
 */

export async function syncSportsMonkData() {
  console.warn("[SportsMonk] Service is deprecated. Re-routing to Sportbex.");
  return { leagues: [], fixtures: [] };
}
