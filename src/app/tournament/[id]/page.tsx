'use client';

import { useParams } from 'next/navigation';
import { useFirestore, useDoc, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Sidebar } from '@/components/layout/Sidebar';
import { Loader2, UserCircle, Star, Trophy, Info, ShieldCheck, ChevronLeft, Globe, CheckCircle2 } from 'lucide-react';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { placeBetAction } from '@/app/actions/betting';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function TournamentOutrightPage() {
  const { id } = useParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const [stake, setStake] = useState('100');
  const [loading, setLoading] = useState(false);
  
  const effectiveUserId = user?.uid || 'guest';

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userData } = useDoc(userRef);

  const tRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'tournaments', id as string);
  }, [firestore, id]);
  const { data: tournament, loading: tLoading } = useDoc(tRef);

  const simulatedTeams = [
    { name: 'India', odds: 3.50 },
    { name: 'Australia', odds: 4.20 },
    { name: 'England', odds: 5.50 },
    { name: 'South Africa', odds: 6.00 },
    { name: 'Pakistan', odds: 8.50 },
    { name: 'New Zealand', odds: 9.00 },
    { name: 'Sri Lanka', odds: 15.0 },
    { name: 'West Indies', odds: 12.0 },
  ];

  const handleBet = async (team: any) => {
    if (!firestore || effectiveUserId === 'guest') {
      toast({ title: 'Access Denied', description: 'Please login to bet.' });
      return;
    }
    setLoading(true);
    const stakeVal = parseFloat(stake);
    const result = await placeBetAction(firestore, effectiveUserId, {
      tournamentId: id,
      matchInfo: `Winner: ${tournament.name}`,
      selectionName: team.name,
      stake: stakeVal,
      odds: team.odds,
      potentialWin: stakeVal * team.odds,
      createdAt: new Date().toISOString()
    });
    setLoading(false);
    if (result.success) toast({ title: 'Bet Placed', description: `Position opened on ${team.name}` });
    else toast({ title: 'Error', description: result.error, variant: 'destructive' });
  };

  if (tLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] text-slate-900">
      <Sidebar userId={effectiveUserId} />
      
      <main className="flex-1 lg:pl-[240px] flex flex-col">
        <header className="exchange-header h-12">
          <div className="flex items-center gap-4">
            <Link href="/"><h1 className="text-2xl font-black italic tracking-tighter">CRICKETVUE</h1></Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs font-bold">Balance: <span className="text-white">{(userData?.tokenBalance || 0).toLocaleString()}</span></div>
            <div className="text-[10px] opacity-70 flex items-center gap-1"><UserCircle size={16} /> {userData?.username || 'Guest'}</div>
          </div>
        </header>

        <nav className="exchange-nav">
          <div className="flex items-center gap-4 h-full">
            <Link href="/tournaments" className="text-white/70 hover:text-white flex items-center gap-1 text-[11px] font-bold uppercase">
              <ChevronLeft size={14} /> Back
            </Link>
            <span className="text-accent border-b-2 border-accent h-full flex items-center text-[11px] font-bold uppercase">{tournament?.name}</span>
          </div>
        </nav>

        <div className="p-3 max-w-4xl mx-auto w-full space-y-4">
          <div className="bg-[#2c3e50] text-white p-8 rounded-sm shadow-md relative overflow-hidden">
             <Star className="absolute -right-4 -top-4 w-32 h-32 text-white/5" />
             <div className="flex gap-2 mb-3">
               <Badge className="bg-accent text-white border-none font-black text-[10px] uppercase">Major Championship</Badge>
               {tournament?.status === 'COMPLETED' && (
                 <Badge className="bg-green-500 text-white border-none font-black text-[10px] uppercase">Finished</Badge>
               )}
             </div>
             <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-2">{tournament?.name}</h2>
             <div className="flex flex-col md:flex-row md:items-center gap-4 text-[11px] font-bold text-white/50 uppercase">
                <span className="flex items-center gap-1"><Globe size={12} /> {tournament?.category}</span>
                <span className="flex items-center gap-1"><Trophy size={12} /> {tournament?.gender}'s {tournament?.type}</span>
                {tournament?.resultText && (
                  <span className="flex items-center gap-1 text-yellow-400 italic">
                    <CheckCircle2 size={12} className="text-green-500" /> {tournament.resultText}
                  </span>
                )}
             </div>
          </div>

          {tournament?.status !== 'COMPLETED' && (
            <div className="bg-slate-800 p-4 rounded-sm border border-white/5 flex items-center gap-4">
              <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Global Stake:</span>
              <Input type="number" value={stake} onChange={(e) => setStake(e.target.value)} className="w-24 h-8 bg-black/40 border-white/10 text-white font-bold" />
              <div className="flex gap-1">
                {['100', '500', '1000', '5000'].map(v => (
                  <button key={v} onClick={() => setStake(v)} className={cn("px-3 py-1 text-[9px] font-black uppercase rounded-sm border", stake === v ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 text-white/50')}>{v}</button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden shadow-sm">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center font-black text-[10px] uppercase text-slate-500">
              <span>{tournament?.status === 'COMPLETED' ? 'Final Series Standings' : 'Tournament Winner - Outright Market'}</span>
              <span>{tournament?.status === 'COMPLETED' ? 'Result' : 'Back Odds'}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {simulatedTeams.map((team, idx) => (
                <div key={idx} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col">
                    <span className="font-black italic uppercase text-slate-800 text-lg tracking-tighter">{team.name}</span>
                    <span className="text-[9px] text-slate-400 font-bold">Estimated Return: <span className="text-primary">{(parseFloat(stake) * team.odds).toFixed(0)}</span></span>
                  </div>
                  {tournament?.status === 'COMPLETED' ? (
                    <div className="text-[10px] font-black uppercase text-slate-300">Market Closed</div>
                  ) : (
                    <button onClick={() => handleBet(team)} className="w-16 h-12 bg-[#72bbef] flex flex-col items-center justify-center rounded-sm hover:brightness-95 transition-all">
                      <span className="text-sm font-black text-blue-900">{team.odds.toFixed(2)}</span>
                      <span className="text-[8px] text-blue-900/40 font-bold uppercase">Back</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 p-4 rounded-sm flex items-start gap-3">
             <Info size={16} className="text-primary shrink-0 mt-0.5" />
             <p className="text-[10px] text-primary/80 font-bold uppercase leading-relaxed">
               {tournament?.status === 'COMPLETED' 
                 ? 'This tournament has concluded. All outright bets have been settled based on the official series results.' 
                 : 'Outright markets settle only after the grand final. Funds are held in escrow until the tournament status is marked as finished in the professional feed.'}
             </p>
          </div>
        </div>
      </main>
    </div>
  );
}
