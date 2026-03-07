
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useUser, useAuth } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { Sidebar } from '@/components/layout/Sidebar';
import { BettingPanel } from '@/components/betting/BettingPanel';
import { AiInsightBox } from '@/components/betting/AiInsightBox';
import { MatchExposure } from '@/components/admin/MatchExposure';
import { Loader2, UserCircle, Zap, ShieldCheck, ChevronLeft, Database, Globe, Info } from 'lucide-react';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { format, parseISO } from 'date-fns';
import { logout } from '@/firebase/auth/auth-service';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { fetchPremiumFancy } from '@/services/cricket-api-service';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function MatchPage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const auth = useAuth();
  const { user } = useUser();
  const [premiumFancyData, setPremiumFancyData] = useState<any[]>([]);
  
  const rawId = params?.id as string;
  const id = rawId ? decodeURIComponent(rawId) : null;
  
  const effectiveUserId = user?.uid || 'guest';

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userData } = useDoc(userRef);

  const matchRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'matches', id);
  }, [firestore, id]);

  const marketsQuery = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return collection(firestore, 'matches', id, 'markets');
  }, [firestore, id]);

  const { data: match, loading: matchLoading } = useDoc(matchRef);
  const { data: markets, loading: marketsLoading } = useCollection(marketsQuery);

  // High-Frequency Premium Fancy Pulse
  useEffect(() => {
    if (match?.betfairEventId) {
      const loadPremium = async () => {
        const data = await fetchPremiumFancy(match.betfairEventId!);
        if (data && Array.isArray(data)) {
          setPremiumFancyData(data);
        }
      };
      loadPremium();
      const interval = setInterval(loadPremium, 10000);
      return () => clearInterval(interval);
    }
  }, [match?.betfairEventId]);

  const handleLogout = async () => {
    if (auth) await logout(auth);
    router.push('/login');
  };

  if (matchLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8f9fa]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Connecting to Exchange...</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex min-h-screen bg-[#f8f9fa] text-slate-900">
        <Sidebar userId={effectiveUserId} />
        <main className="flex-1 lg:pl-[240px] flex flex-col items-center justify-center p-8 text-center space-y-6">
          <Database size={48} className="text-slate-200" />
          <h2 className="text-xl font-black uppercase">Market Suspended</h2>
          <Link href="/dashboard">
            <Button className="bg-primary text-white text-[10px] font-black uppercase italic tracking-tighter">Back to Terminal</Button>
          </Link>
        </main>
      </div>
    );
  }

  const matchDate = match.startTime ? parseISO(match.startTime) : new Date();

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] text-slate-900">
      <Sidebar userId={effectiveUserId} />
      
      <main className="flex-1 lg:pl-[240px] flex flex-col">
        <header className="exchange-header h-12">
          <div className="flex items-center gap-4">
            <Link href="/">
               <h1 className="text-2xl font-black italic tracking-tighter">CRICKETVUE</h1>
            </Link>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="opacity-80">Balance:</span>
              <span className="text-white">
                {userData?.role === 'admin' ? 'UNLIMITED' : (userData?.tokenBalance || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] opacity-70 cursor-pointer" onClick={handleLogout}>
              <UserCircle size={16} />
              <span>{userData?.username || 'User'}</span>
            </div>
          </div>
        </header>

        <nav className="exchange-nav">
          <div className="flex items-center justify-between w-full h-full">
            <div className="flex items-center gap-4 h-full">
              <Link href="/dashboard" className="text-white/70 hover:text-white flex items-center gap-1 text-[11px] font-bold uppercase">
                <ChevronLeft size={14} /> Back
              </Link>
              <div className="w-px h-4 bg-white/10" />
              <span className="text-accent border-b-2 border-accent h-full flex items-center text-[11px] font-bold uppercase">
                {match.teamA} v {match.teamB}
              </span>
            </div>
            <div className="hidden md:flex items-center gap-4 text-[10px] font-black uppercase text-white/40">
              <span>{match.series}</span>
              <span>{format(matchDate, 'dd/MM/yyyy HH:mm')}</span>
            </div>
          </div>
        </nav>

        <div className="bg-[#1a2531] text-white overflow-hidden shadow-lg m-1 md:m-3 rounded-sm">
          <div className="flex justify-between items-center bg-[#0d141b] px-4 py-1.5 border-b border-white/5">
             <span className="text-[11px] font-black uppercase italic tracking-tighter text-accent">{match.teamA} V {match.teamB}</span>
             <span className="text-[10px] font-bold text-white/40">{format(matchDate, 'dd/MM/yyyy HH:mm')}</span>
          </div>
          
          <div className="p-4 md:p-6 flex flex-col md:flex-row gap-6 md:items-center">
            <div className="flex-1 space-y-3">
               <div className="flex items-center justify-between group">
                  <div className="space-y-1">
                     <h3 className="text-xl md:text-2xl font-black italic tracking-tighter uppercase">{match.teamA?.substring(0, 3)}</h3>
                  </div>
                  <div className="text-right">
                     <span className="text-xl md:text-2xl font-mono font-black text-yellow-400">
                       {match.currentScore?.split(' v ')?.[0] || '0/0 (0.0 ov)'}
                     </span>
                  </div>
               </div>
               <div className="flex items-center justify-between group">
                  <div className="space-y-1">
                     <h3 className="text-xl md:text-2xl font-black italic tracking-tighter uppercase">{match.teamB?.substring(0, 3)}</h3>
                  </div>
                  <div className="text-right">
                     <span className="text-xl md:text-2xl font-mono font-black text-white/90">
                       {match.currentScore?.split(' v ')?.[1] || 'Yet to bat'}
                     </span>
                  </div>
               </div>
            </div>

            <div className="w-full md:w-[300px] bg-black/30 p-4 rounded-sm border border-white/5 flex flex-col justify-center">
               <div className="grid grid-cols-2 gap-4">
                  <div className="text-center border-r border-white/5">
                     <p className="text-[9px] font-black uppercase text-white/30 tracking-widest mb-1">CRR</p>
                     <p className="text-lg font-black text-accent">12.21</p>
                  </div>
                  <div className="text-center">
                     <p className="text-[9px] font-black uppercase text-white/30 tracking-widest mb-1">RRR</p>
                     <p className="text-lg font-black text-yellow-400">13.12</p>
                  </div>
               </div>
               <div className="mt-4 pt-4 border-t border-white/5 text-center">
                  <p className="text-[10px] font-black uppercase italic text-white/60">
                    {match.statusText || 'Match in progress'}
                  </p>
               </div>
            </div>

            <div className="flex md:flex-col gap-2 md:gap-4 items-center justify-center">
               <div className="flex gap-1.5">
                  {[1, 0, 4, 1, 'W', 1].map((ball, i) => (
                    <div key={i} className={cn(
                      "last-ball-circle",
                      ball === 4 ? 'bg-blue-500' : ball === 'W' ? 'bg-red-500' : ball === 6 ? 'bg-yellow-500' : 'bg-white/10'
                    )}>
                      {ball}
                    </div>
                  ))}
               </div>
               <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Last 6 Balls</span>
            </div>
          </div>
        </div>

        <div className="p-1 md:p-3 grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-3">
          <div className="space-y-3">
            <BettingPanel 
              match={{...match, markets}} 
              userId={effectiveUserId} 
              premiumFancyOverride={premiumFancyData}
            />
          </div>
          
          <div className="space-y-3">
            {userData?.role === 'admin' && (
              <MatchExposure matchId={match.id} />
            )}
            
            <AiInsightBox teamA={match.teamA} teamB={match.teamB} status={match.status} />
            
            <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-4">
               <div className="flex items-center gap-2 mb-4">
                  <Info size={14} className="text-primary" />
                  <h3 className="text-[11px] font-black uppercase text-slate-400">Matched Bets</h3>
               </div>
               <div className="bg-slate-50 border border-slate-100 rounded-sm p-8 text-center">
                  <p className="text-[10px] font-bold text-slate-300 uppercase italic">No active positions on this match</p>
               </div>
            </div>

            <div className="bg-[#2c3e50] text-white p-4 rounded-sm">
               <h3 className="text-[11px] font-black uppercase text-accent mb-4">Network Status</h3>
               <div className="space-y-3 text-[10px] font-bold uppercase">
                  <div className="flex justify-between items-center text-white/40">
                     <span>Latency</span>
                     <span className="text-green-500">24ms</span>
                  </div>
                  <div className="flex justify-between items-center text-white/40">
                     <span>Betfair Pulse</span>
                     <span className="text-green-500">Connected</span>
                  </div>
                  <div className="flex justify-between items-center text-white/40">
                     <span>Data Engine</span>
                     <span>v2.5.9</span>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
