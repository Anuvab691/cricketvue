'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { placeBetAction } from '@/app/actions/betting';
import { toast } from '@/hooks/use-toast';
import { Zap, Trophy, LayoutGrid, Info } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { cn } from '@/lib/utils';

export function BettingPanel({ match, userId }: { match: any, userId: string }) {
  const [stake, setStake] = useState<string>('100');
  const [loading, setLoading] = useState(false);
  const firestore = useFirestore();

  const handlePlaceBet = async (market: any, selection: any) => {
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
      matchInfo: `${match.teamA} vs ${match.teamB}`,
      selectionName: selection.name,
      stake: stakeVal,
      odds: selection.odds,
      potentialWin: stakeVal * selection.odds,
      betType: market.type === 'next_ball' ? 'live_micro' : 'pre_match'
    };

    const result = await placeBetAction(firestore, userId, betData);
    setLoading(false);

    if (result.error) {
      toast({ title: 'Terminal Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Stake Accepted', description: `Position opened on ${selection.name} at ${selection.odds}` });
    }
  };

  const stakeNum = parseFloat(stake) || 0;

  return (
    <div className="space-y-3">
      {/* Stake Quick Entry */}
      <div className="bg-slate-800 p-3 rounded-sm border border-white/5 flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Entry Stake:</span>
        <div className="relative">
          <Input 
            type="number" 
            value={stake} 
            onChange={(e) => setStake(e.target.value)} 
            className="w-24 h-8 bg-black/40 border-white/10 text-white font-bold text-xs pl-2"
          />
        </div>
        <div className="flex gap-1">
          {['100', '500', '1000', '5000'].map(val => (
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

      <Tabs defaultValue="match_winner" className="w-full">
        <div className="bg-[#2c3e50] p-1 rounded-sm mb-3">
          <TabsList className="grid grid-cols-2 w-full bg-transparent p-0 h-8 gap-1">
            <TabsTrigger value="match_winner" className="rounded-sm font-black text-[10px] uppercase h-full data-[state=active]:bg-primary data-[state=active]:text-white bg-white/5 text-white/50 border-none">
              <Trophy className="w-3 h-3 mr-2" /> Match Markets
            </TabsTrigger>
            <TabsTrigger value="next_ball" disabled={match.status !== 'live'} className="rounded-sm font-black text-[10px] uppercase h-full data-[state=active]:bg-accent data-[state=active]:text-white bg-white/5 text-white/50 border-none">
              <Zap className="w-3 h-3 mr-2" /> Fancy / Live
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="match_winner" className="space-y-2 mt-0">
          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
               <span className="text-[10px] font-black uppercase text-slate-500">Match Winner (Back / Lay)</span>
               <div className="flex gap-1 text-[10px] font-bold text-slate-400">
                  <span className="w-10 text-center">Back</span>
                  <span className="w-10 text-center">Lay</span>
               </div>
            </div>
            
            {match.markets?.filter((m: any) => m.type === 'match_winner').map((market: any) => (
              <div key={market.id} className="divide-y divide-slate-100">
                {market.selections.map((selection: any) => (
                  <div key={selection.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-black italic uppercase text-slate-800 tracking-tighter">{selection.name}</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase">
                        Potential Win: <span className="text-primary">{(stakeNum * selection.odds).toFixed(0)}</span>
                      </span>
                    </div>
                    <div className="flex gap-1">
                       <button 
                         onClick={() => handlePlaceBet(market, selection)}
                         className="w-12 h-10 bg-[#72bbef] flex flex-col items-center justify-center rounded-sm hover:brightness-95 transition-all"
                       >
                          <span className="text-xs font-black text-blue-900">{selection.odds.toFixed(2)}</span>
                          <span className="text-[8px] text-blue-900/50 font-bold">0</span>
                       </button>
                       <button 
                         className="w-12 h-10 bg-[#faa9ba] flex flex-col items-center justify-center rounded-sm opacity-50 cursor-not-allowed"
                       >
                          <span className="text-xs font-black text-pink-900">{(selection.odds + 0.1).toFixed(2)}</span>
                          <span className="text-[8px] text-pink-900/50 font-bold">0</span>
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="next_ball" className="space-y-2 mt-0">
          <div className="bg-[#2c3e50] border border-white/5 rounded-sm overflow-hidden">
            <div className="bg-slate-800/50 px-4 py-2 border-b border-white/5 flex justify-between items-center">
               <span className="text-[10px] font-black uppercase text-white/50 flex items-center gap-2">
                 <Zap size={12} className="text-accent" /> Instant Micro Markets
               </span>
               <Badge variant="outline" className="text-[9px] border-accent/30 text-accent h-4 font-black">OPEN</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/5">
              {match.markets?.filter((m: any) => m.type === 'next_ball').map((market: any) => (
                market.selections.map((selection: any) => (
                  <div key={selection.id} className="bg-slate-900 p-4 flex justify-between items-center group">
                    <div className="space-y-1">
                      <span className="text-[11px] font-black text-white uppercase tracking-wider">{selection.name}</span>
                      <p className="text-[9px] text-white/30 font-bold">Instantly settled</p>
                    </div>
                    <button 
                      onClick={() => handlePlaceBet(market, selection)}
                      className="bg-accent hover:bg-accent/90 text-white px-6 py-2 rounded-sm font-black text-[11px] uppercase italic tracking-tighter"
                    >
                      x{selection.odds.toFixed(2)}
                    </button>
                  </div>
                ))
              ))}
            </div>
          </div>
          
          <div className="bg-yellow-400/10 border border-yellow-400/20 p-3 rounded-sm flex items-start gap-3">
             <Info size={14} className="text-yellow-400 shrink-0 mt-0.5" />
             <p className="text-[10px] text-yellow-400/80 font-bold uppercase leading-relaxed">
               Instant markets settle upon the next ball event update from the actual web data source. 
               Markets may suspend at any time.
             </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
