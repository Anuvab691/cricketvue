'use server';

import { db } from '@/lib/db-mock';
import { generateMatchInsight } from '@/ai/flows/ai-match-insights';
import { revalidatePath } from 'next/cache';

export async function placeBetAction(formData: FormData) {
  const userId = formData.get('userId') as string;
  const selectionId = formData.get('selectionId') as string;
  const marketId = formData.get('marketId') as string;
  const matchId = formData.get('matchId') as string;
  const stake = parseFloat(formData.get('stake') as string);
  const odds = parseFloat(formData.get('odds') as string);
  const selectionName = formData.get('selectionName') as string;
  const teamA = formData.get('teamA') as string;
  const teamB = formData.get('teamB') as string;
  const betType = formData.get('betType') as 'pre_match' | 'live_micro';

  if (isNaN(stake) || stake <= 0) {
    return { error: 'Invalid stake amount' };
  }

  try {
    const potentialWin = stake * odds;
    const matchInfo = `${teamA} vs ${teamB}`;
    
    db.placeBet({
      userId,
      selectionId,
      matchInfo,
      selectionName,
      stake,
      odds,
      potentialWin,
      betType,
    });

    revalidatePath('/dashboard');
    revalidatePath(`/match/${matchId}`);
    revalidatePath('/my-bets');
    
    return { success: true };
  } catch (e: any) {
    return { error: e.message || 'Failed to place bet' };
  }
}

export async function getAiInsight(teamA: string, teamB: string, status: string) {
  return await generateMatchInsight({ teamA, teamB, matchStatus: status });
}

export async function settleMockBet(betId: string, result: 'won' | 'lost') {
  db.settleBet(betId, result);
  revalidatePath('/my-bets');
  revalidatePath('/dashboard');
}