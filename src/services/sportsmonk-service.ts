'use server';

/**
 * @fileOverview This file has been deprecated and replaced by the Sportbex integration.
 */

export async function syncSportsMonkData() {
  console.warn("SportsMonk service is deprecated. Use Sportbex via cricket-api-service instead.");
  return { leagues: [], fixtures: [] };
}
