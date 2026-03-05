'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { placeBetAction } from '@/app/actions/betting';
import { toast } from '@/hooks/use-toast';
import { Trophy, Zap, Info, Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { cn } from '@/lib/utils';

export function BettingPanel({ match, userId }: { match: any, userId: string }) {
  const [stake, setStake] = useState<string>('100');
  const [loading, setLoading] = useState(false);
  const firestore = useFirestore();

  const handlePlaceBet = async (market: any, selection: any, odds: number, isLay: boolean = false) => {
    if (!firestore || !userId || userId === 'guest') {
      toast({ title: 'Access Denied', description: 'Please login to place your stakes.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const stakeVal = parseFloat(stake);
    
    const betData = {
      userId,
      matchId: match.id,
      selectionId: selection.id,
      marketId: market.id,
      matchInfo: match.name || `${match.teamA} v ${match.teamB}`,
      selectionName: `${selection.name}${isLay ? ' (LAY)' : ''}`,
      stake: stakeVal,
      odds: odds,
      potentialWin: isLay ? stakeVal : (stakeVal * (odds - 1)),
      type: isLay ? 'lay' : 'back',
      createdAt: new Date().toISOString()
    };

    const result = await placeBetAction(firestore, userId, betData);
    setLoading(false);

    if (result.error) {
      toast({ title: 'Terminal Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Stake Accepted', description: `Position opened on ${selection.name} at ${odds}` });
    }
  };

  const stakeNum = parseFloat(stake) || 0;

  // Market Grouping
  const matchWinnerMarket = match.markets?.find((m: any) => m.type === 'match_winner');
  const bookmakerMarket = match.markets?.find((m: any) => m.type === 'bookmaker');
  const fancyMarket = match.markets?.find((m: any) => m.type === 'fancy');

  return (
    <div className="space-y-4">
      {/* Stake Quick Entry */}
      <div className="bg-[#2c3e50] p-3 rounded-sm border border-white/5 flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Entry Stake:</span>
        <Input 
          type="number" 
          value={stake} 
          onChange={(e) => setStake(e.target.value)} 
          className="w-24 h-8 bg-black/40 border-white/10 text-white font-bold text-xs pl-2"
        />
        <div className="flex gap-1">
          {['100', '500', '1000', '5000', '10000'].map(val => (
            <button 
              key={val} 
              onClick={() => setStake(val)}
              className={cn(
                "px-3 py-1 text-[9px] font-black uppercase rounded-sm border transition-all",
                stake === val ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
              )}
            >
              {val}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {/* Match Odds Market */}
        <div className="bg-white border border-slate-200 rounded-sm shadow-sm">
          <div className="market-header">
            <span>MATCH_ODDS</span>
            <div className="flex gap-1 text-[9px] font-black uppercase">
               <span className="bg-primary px-2 py-0.5 rounded-sm">Cashout</span>
               <span className="bg-slate-700 px-2 py-0.5 rounded-sm">Max: 2L</span>
            </div>
          </div>

          <div className="grid grid-cols-[1fr,auto] border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase text-slate-500 py-1 px-4">
            <span>Selection</span>
            <div className="grid grid-cols-6 w-[288px] text-center">
              <span className="col-span-3 text-blue-500">Back</span>
              <span className="col-span-3 text-pink-500">Lay</span>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {matchWinnerMarket?.selections.map((selection: any) => {
              const backOdds = selection.odds || 1.0;
              const layOdds = selection.layOdds || (backOdds > 1 ? backOdds + 0.02 : 0);
              
              return (
                <div key={selection.id} className="flex items-center justify-between h-14 hover:bg-slate-50 transition-colors">
                  <div className="px-4 flex flex-col">
                    <span className="font-black italic uppercase text-slate-800 tracking-tighter text-sm">{selection.name}</span>
                    <span className="text-[9px] text-red-500 font-bold">-{stakeNum.toFixed(0)}</span>
                  </div>

                  <div className="grid grid-cols-6 w-[288px] h-full items-center">
                    {/* Back Grid */}
                    <div className="odds-grid-box odds-back-light" onClick={() => handlePlaceBet(matchWinnerMarket, selection, backOdds - 0.02, false)}>
                      <span>{(backOdds - 0.02).toFixed(2)}</span>
                      <span className="text-[8px] opacity-40">10k</span>
                    </div>
                    <div className="odds-grid-box odds-back-light" onClick={() => handlePlaceBet(matchWinnerMarket, selection, backOdds - 0.01, false)}>
                      <span>{(backOdds - 0.01).toFixed(2)}</span>
                      <span className="text-[8px] opacity-40">50k</span>
                    </div>
                    <div className="odds-grid-box odds-back" onClick={() => handlePlaceBet(matchWinnerMarket, selection, backOdds, false)}>
                      <span className="text-xs">{backOdds.toFixed(2)}</span>
                      <span className="text-[8px] opacity-40">1.2L</span>
                    </div>

                    {/* Lay Grid */}
                    <div className="odds-grid-box odds-lay" onClick={() => handlePlaceBet(matchWinnerMarket, selection, layOdds, true)}>
                      <span className="text-xs">{layOdds.toFixed(2)}</span>
                      <span className="text-[8px] opacity-40">45k</span>
                    </div>
                    <div className="odds-grid-box odds-lay-light" onClick={() => handlePlaceBet(matchWinnerMarket, selection, layOdds + 0.01, true)}>
                      <span>{(layOdds + 0.01).toFixed(2)}</span>
                      <span className="text-[8px] opacity-40">25k</span>
                    </div>
                    <div className="odds-grid-box odds-lay-light border-r-0" onClick={() => handlePlaceBet(matchWinnerMarket, selection, layOdds + 0.02, true)}>
                      <span>{(layOdds + 0.02).toFixed(2)}</span>
                      <span className="text-[8px] opacity-40">15k</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bookmaker Market Section */}
        <div className="bg-white border border-slate-200 rounded-sm shadow-sm">
          <div className="market-header bg-[#34495e]">
            <span>Bookmaker</span>
            <span className="text-[9px] opacity-50">Min: 100 Max: 100L</span>
          </div>
          {bookmakerMarket ? (
             <div className="divide-y divide-slate-100">
               {bookmakerMarket.selections.map((selection: any) => (
                 <div key={selection.id} className="flex items-center justify-between h-14 hover:bg-slate-50 transition-colors">
                    <div className="px-4">
                      <span className="font-black italic uppercase text-slate-800 tracking-tighter text-sm">{selection.name}</span>
                    </div>
                    <div className="flex">
                      <div className="odds-grid-box odds-back w-24 border-r border-slate-200" onClick={() => handlePlaceBet(bookmakerMarket, selection, selection.odds, false)}>
                        <span className="text-xs">{selection.odds.toFixed(2)}</span>
                      </div>
                      <div className="odds-grid-box odds-lay w-24" onClick={() => handlePlaceBet(bookmakerMarket, selection, selection.layOdds, true)}>
                        <span className="text-xs">{selection.layOdds.toFixed(2)}</span>
                      </div>
                    </div>
                 </div>
               ))}
             </div>
          ) : (
            <div className="p-4 text-center text-slate-300 text-[10px] font-bold italic">
              Bookmaker market suspended - No active liquidity found.
            </div>
          )}
        </div>

        {/* Fancy Markets Section */}
        <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
          <div className="market-header bg-[#16a085]">
            <span>Normal (Fancy)</span>
            <Badge variant="outline" className="text-[9px] border-white/20 text-white h-4 font-black">ACTIVE</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100">
            {fancyMarket ? fancyMarket.selections.map((fancy: any, idx: number) => (
              <div key={idx} className="bg-white p-3 flex justify-between items-center group h-auto min-h-[48px]">
                <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight max-w-[140px] leading-tight">{fancy.name}</span>
                <div className="flex gap-1">
                   <button className="w-12 h-9 bg-pink-100 border border-pink-200 text-pink-700 rounded-sm flex flex-col items-center justify-center hover:bg-pink-200">
                     <span className="text-xs font-black">{fancy.no || 0}</span>
                     <span className="text-[8px] font-bold">No</span>
                   </button>
                   <button className="w-12 h-9 bg-blue-100 border border-blue-200 text-blue-700 rounded-sm flex flex-col items-center justify-center hover:bg-blue-200">
                     <span className="text-xs font-black">{fancy.yes || 0}</span>
                     <span className="text-[8px] font-bold">Yes</span>
                   </button>
                </div>
              </div>
            )) : (
              <div className="bg-white p-8 text-center w-full col-span-2">
                 <Loader2 className="animate-spin mx-auto text-slate-200 mb-2" size={24} />
                 <p className="text-[10px] text-slate-300 font-bold uppercase italic">Syncing live fancy markets...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
