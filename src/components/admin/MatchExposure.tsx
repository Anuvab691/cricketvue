
'use client';

import { useFirestore, useCollection } from '@/firebase';
import { collectionGroup, query, where } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { ShieldAlert, TrendingUp, Loader2, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MatchExposureProps {
  matchId: string;
}

export function MatchExposure({ matchId }: MatchExposureProps) {
  const firestore = useFirestore();

  const betsQuery = useMemoFirebase(() => {
    if (!firestore || !matchId) return null;
    return query(
      collectionGroup(firestore, 'bets'),
      where('matchId', '==', matchId),
      where('status', '==', 'open')
    );
  }, [firestore, matchId]);

  const { data: bets, loading } = useCollection(betsQuery);

  const exposure = useMemoFirebase(() => {
    if (!bets) return {};
    
    return bets.reduce((acc: any, bet: any) => {
      const selection = bet.selectionName || 'Unknown';
      if (!acc[selection]) {
        acc[selection] = {
          totalStake: 0,
          potentialLiability: 0,
          count: 0
        };
      }
      acc[selection].totalStake += bet.stake || 0;
      acc[selection].potentialLiability += bet.potentialWin || 0;
      acc[selection].count += 1;
      return acc;
    }, {});
  }, [bets]);

  const totalVolume = Object.values(exposure).reduce((sum: number, item: any) => sum + item.totalStake, 0);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-sm p-6 flex flex-col items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-[10px] font-black uppercase text-slate-400">Calculating Exposure...</span>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
      <div className="bg-primary text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} className="text-yellow-400" />
          <h3 className="text-[11px] font-black uppercase italic tracking-tighter">Admin Market Analysis</h3>
        </div>
        <Badge variant="outline" className="text-[9px] border-white/20 text-white font-black">
          VOL: {totalVolume.toLocaleString()}
        </Badge>
      </div>

      <div className="p-4 space-y-4">
        {Object.keys(exposure).length > 0 ? (
          <div className="space-y-3">
            {Object.entries(exposure).map(([selection, data]: [string, any]) => (
              <div key={selection} className="space-y-1">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black uppercase text-slate-600 truncate max-w-[140px]">{selection}</span>
                  <span className="text-[9px] font-bold text-slate-400">{data.count} Position(s)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 p-2 border border-slate-100 rounded-sm">
                    <p className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">Total Stake</p>
                    <p className="text-xs font-black text-slate-900">{data.totalStake.toLocaleString()}</p>
                  </div>
                  <div className="bg-red-50 p-2 border border-red-100 rounded-sm">
                    <p className="text-[8px] font-black uppercase text-red-400 leading-none mb-1">Max Liability</p>
                    <p className="text-xs font-black text-red-600">-{data.potentialLiability.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center flex flex-col items-center gap-2">
            <BarChart3 size={32} className="text-slate-100" />
            <p className="text-[10px] font-bold text-slate-300 uppercase italic">No active risk on this market</p>
          </div>
        )}

        <div className="pt-4 border-t border-slate-100">
           <div className="flex items-center gap-2 text-[9px] font-black uppercase text-primary/60">
             <TrendingUp size={12} />
             <span>Global Network Exposure Active</span>
           </div>
        </div>
      </div>
    </div>
  );
}
