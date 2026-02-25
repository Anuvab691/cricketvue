'use client';

import { settleMockBet } from '@/app/actions/betting';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

export function SettleAction({ betId }: { betId: string }) {
  const handleSettle = async (res: 'won' | 'lost') => {
    await settleMockBet(betId, res);
    toast({ title: 'Bet Settled', description: `Result marked as ${res.toUpperCase()}` });
  };

  return (
    <div className="flex gap-1">
      <Button size="sm" variant="outline" className="h-7 text-[10px] border-green-500 text-green-500 hover:bg-green-500 hover:text-white" onClick={() => handleSettle('won')}>Win</Button>
      <Button size="sm" variant="outline" className="h-7 text-[10px] border-red-500 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => handleSettle('lost')}>Lose</Button>
    </div>
  );
}