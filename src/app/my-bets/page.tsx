'use client';

import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, orderBy, query, doc } from 'firebase/firestore';
import { Sidebar } from '@/components/layout/Sidebar';
import { Badge } from '@/components/ui/badge';
import { History, Loader2, XCircle, Info, UserCircle, Zap, LayoutGrid } from 'lucide-react';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { Button } from '@/components/ui/button';
import { cancelBetAction } from '@/app/actions/betting';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Component to calculate and display the estimated return if a bet is cancelled.
 */
function CancelValueEstimate({ bet }: { bet: any }) {
  const firestore = useFirestore();
  const marketRef = useMemoFirebase(() => {
    if (!firestore || !bet.matchId || !bet.marketId) return null;
    return doc(firestore, 'matches', bet.matchId, 'markets', bet.marketId);
  }, [firestore, bet.matchId, bet.marketId]);

  const { data: market, loading } = useDoc(marketRef);

  if (loading) return <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />;
  if (!market) return <span className="text-muted-foreground">-</span>;

  const selection = market.selections?.find((s: any) => s.id === bet.selectionId);
  const currentOdds = selection?.odds || bet.odds;

  // Logic: (Original Stake * (Original Odds / Current Odds)) * 0.95
  const estReturn = (bet.stake * (bet.odds / currentOdds)) * 0.95;

  return (
    <div className="flex items-center gap-1 font-mono text-[10px] font-bold">
      <span className={estReturn >= bet.stake ? 'text-green-600' : 'text-orange-500'}>
        {estReturn.toFixed(2)}
      </span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Info className="w-3 h-3 text-slate-400" />
          </TooltipTrigger>
          <TooltipContent className="text-[10px] max-w-[200px] bg-slate-800 text-white border-none">
            Estimated return based on current market odds vs your odds (minus 5% fee).
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export default function MyBetsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const pathname = usePathname();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  
  const effectiveUserId = user?.uid || 'guest';

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userData } = useDoc(userRef);

  const betsQuery = useMemoFirebase(() => {
    if (!firestore || !effectiveUserId || effectiveUserId === 'guest') return null;
    return query(collection(firestore, 'users', effectiveUserId, 'bets'), orderBy('createdAt', 'desc'));
  }, [firestore, effectiveUserId]);

  const { data: bets, loading: betsLoading } = useCollection(betsQuery);

  const handleCancelBet = async (betId: string) => {
    if (!firestore || !effectiveUserId) return;
    setCancellingId(betId);
    const result = await cancelBetAction(firestore, effectiveUserId, betId);
    setCancellingId(null);

    if (result.success) {
      toast({ 
        title: 'Bet Cancelled', 
        description: 'Stake returned based on market rate.' 
      });
    } else {
      toast({ 
        title: 'Error', 
        description: result.error || 'Failed to cancel', 
        variant: 'destructive' 
      });
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] text-slate-900">
      <Sidebar userId={effectiveUserId} />
      
      <main className="flex-1 lg:pl-[240px] flex flex-col">
        {/* Top Header */}
        <header className="exchange-header h-12">
          <div className="flex items-center gap-4">
            <Link href="/">
               <h1 className="text-2xl font-black italic tracking-tighter">CRICKETVUE</h1>
            </Link>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="opacity-80">Balance:</span>
              <span className="text-yellow-400">
                {userData?.role === 'admin' ? 'UNLIMITED' : (userData?.tokenBalance || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] opacity-70">
              <UserCircle size={16} />
              <span>{userData?.username || 'Guest'}</span>
            </div>
          </div>
        </header>

        {/* Main Nav */}
        <nav className="exchange-nav">
          <div className="flex items-center gap-6 h-full">
            <Link href="/dashboard" className="text-white/70 hover:text-white transition-all text-[11px] font-bold uppercase">
              Dashboard
            </Link>
            <span className="text-accent border-b-2 border-accent h-full flex items-center text-[11px] font-bold uppercase">
              My Activity
            </span>
          </div>
        </nav>

        {/* Sub Nav */}
        <div className="exchange-sub-nav">
          <div className="flex items-center gap-4 w-full">
            <div className="bg-slate-800 text-white px-2 py-1 rounded text-[10px] flex items-center gap-1 shrink-0">
              <History size={10} className="text-accent" /> Bet History
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Track your virtual stakes and real-time market valuations.</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-3">
          <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
            <div className="bg-[#2c3e50] text-white px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayoutGrid size={14} className="text-accent" /> Open & Settled Bets
              </div>
              <Badge variant="outline" className="text-[10px] border-white/20 text-white h-5">
                {(bets?.length || 0)} Recorded
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 font-black uppercase tracking-tighter h-10">
                    <th className="px-4">Match Event</th>
                    <th className="px-4">Selection</th>
                    <th className="px-4 text-center">Stake</th>
                    <th className="px-4 text-center">Odds</th>
                    <th className="px-4 text-center">Potential</th>
                    <th className="px-4 text-center">Live Value</th>
                    <th className="px-4 text-center">Status</th>
                    <th className="px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {betsLoading ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center">
                        <Loader2 className="animate-spin mx-auto text-primary" size={24} />
                      </td>
                    </tr>
                  ) : bets && bets.length > 0 ? (
                    bets.map((bet) => (
                      <tr key={bet.id} className="h-12 hover:bg-slate-50 transition-colors">
                        <td className="px-4 font-bold text-slate-700">{bet.matchInfo}</td>
                        <td className="px-4">
                          <span className="font-black uppercase italic tracking-tighter text-primary">{bet.selectionName}</span>
                        </td>
                        <td className="px-4 text-center font-bold text-slate-600">{bet.stake}</td>
                        <td className="px-4 text-center font-mono">x{bet.odds?.toFixed(2)}</td>
                        <td className="px-4 text-center font-black text-accent">{bet.potentialWin?.toFixed(0)}</td>
                        <td className="px-4 text-center">
                          {bet.status === 'open' ? (
                            <CancelValueEstimate bet={bet} />
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">
                              {bet.returnedAmount ? `Settled: ${bet.returnedAmount.toFixed(0)}` : '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 text-center">
                          <Badge 
                            className={cn(
                              "text-[9px] font-black uppercase px-2 h-5 border-none",
                              bet.status === 'won' ? 'bg-green-500 text-white' : 
                              bet.status === 'lost' ? 'bg-red-500 text-white' : 
                              bet.status === 'cancelled' ? 'bg-slate-400 text-white' : 'bg-primary text-white'
                            )}
                          >
                            {bet.status}
                          </Badge>
                        </td>
                        <td className="px-4 text-right">
                          {bet.status === 'open' ? (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-7 text-[9px] font-black uppercase border-red-200 text-red-500 hover:bg-red-500 hover:text-white"
                              onClick={() => handleCancelBet(bet.id)}
                              disabled={cancellingId === bet.id}
                            >
                              {cancellingId === bet.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3 mr-1" /> Cash Out
                                </>
                              )}
                            </Button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Finalized</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400 font-medium italic">
                        No betting activity found. Visit the dashboard to place your first bet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="bg-slate-50 p-4 border-t border-slate-200">
              <div className="flex items-center gap-6 text-[10px] text-slate-400 font-bold uppercase">
                <div className="flex items-center gap-1"><Zap size={10} className="text-accent" /> Live values update every 15s</div>
                <div>5% commission applies to all cancellations</div>
                <div>All wins settled instantly upon match completion</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
