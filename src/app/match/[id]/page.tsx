'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useUser, useAuth } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { Sidebar } from '@/components/layout/Sidebar';
import { BettingPanel } from '@/components/betting/BettingPanel';
import { AiInsightBox } from '@/components/betting/AiInsightBox';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserCircle, Zap, ShieldCheck, ChevronLeft, Database } from 'lucide-react';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { format, parseISO } from 'date-fns';
import { logout } from '@/firebase/auth/auth-service';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { syncCricketMatchesAction } from '@/app/actions/sync-matches';
import { toast } from '@/hooks/use-toast';

export default function MatchPage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const auth = useAuth();
  const { user } = useUser();
  const [isSyncing, setIsSyncing] = useState(false);
  
  // CRITICAL: Explicitly decode the ID to handle spaces and encoded characters
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

  const handleLogout = async () => {
    if (auth) await logout(auth);
    router.push('/login');
  };

  const handleManualSync = async () => {
    if (!firestore) return;
    setIsSyncing(true);
    const res = await syncCricketMatchesAction(firestore);
    setIsSyncing(false);
    if (res.success) {
      toast({ title: "Network Refreshed", description: "Market data synchronized." });
    }
  };

  if (matchLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8f9fa]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Accessing Network Feed...</p>
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
          <div className="space-y-2">
            <h2 className="text-xl font-black uppercase tracking-tighter">Match Data Unavailable</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest max-w-sm mx-auto">
              The record for ID "{id}" was not found in the local terminal. Use the sync control to refresh the global feed.
            </p>
          </div>
          <div className="flex gap-3">
             <Link href="/dashboard">
                <Button variant="outline" className="text-[10px] font-black uppercase italic tracking-tighter">Return to Dashboard</Button>
             </Link>
             <Button onClick={handleManualSync} disabled={isSyncing} className="bg-primary text-white text-[10px] font-black uppercase italic tracking-tighter">
               {isSyncing ? 'Syncing...' : 'Sync Network Now'}
             </Button>
          </div>
        </main>
      </div>
    );
  }

  const enhancedMatch = {
    ...match,
    markets: markets || []
  };

  const matchDate = match.startTime ? parseISO(match.startTime) : new Date();

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
            <div className="text-[10px] bg-white/20 px-2 py-0.5 rounded flex items-center gap-1">
              <ShieldCheck size={10} className={isSyncing ? "text-yellow-400 animate-pulse" : ""} /> 
              {isSyncing ? 'SYNCING LIVE...' : 'NETWORK ACTIVE'}
            </div>
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="opacity-80">Balance:</span>
              <span className="text-yellow-400">
                {userData?.role === 'admin' ? 'UNLIMITED' : (userData?.tokenBalance || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] opacity-70 cursor-pointer hover:opacity-100" onClick={handleLogout}>
              <UserCircle size={16} />
              <span>{userData?.username || 'User'}</span>
            </div>
          </div>
        </header>

        {/* Secondary Nav / Breadcrumbs */}
        <nav className="exchange-nav">
          <div className="flex items-center gap-4 h-full">
            <Link href="/dashboard" className="text-white/70 hover:text-white flex items-center gap-1 transition-all text-[11px] font-bold uppercase">
              <ChevronLeft size={14} /> Back
            </Link>
            <div className="w-px h-4 bg-white/10" />
            <span className="text-accent border-b-2 border-accent h-full flex items-center text-[11px] font-bold uppercase">
              {match.teamA} v {match.teamB}
            </span>
          </div>
        </nav>

        {/* Match Ticker */}
        <div className="exchange-sub-nav">
          <div className="flex items-center gap-4 w-full">
            <div className="bg-slate-800 text-white px-2 py-1 rounded text-[10px] flex items-center gap-1 shrink-0">
              <Zap size={10} className="fill-yellow-400 text-yellow-400" /> Professional Sync
            </div>
            <p className="text-[11px] font-bold text-slate-600 truncate">
              {match.series} | {match.venue} | {format(matchDate, 'dd/MM/yyyy HH:mm')}
            </p>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-1 md:p-3 space-y-3">
          {/* Live Score Header */}
          <div className="bg-[#2c3e50] text-white p-4 md:p-6 rounded-sm shadow-md">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-8 text-center md:text-left">
                <div className="space-y-1">
                  <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter leading-none">{match.teamA}</h2>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Home Team</p>
                </div>
                <div className="text-xl font-black italic text-accent/50">VS</div>
                <div className="space-y-1">
                  <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter leading-none">{match.teamB}</h2>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Away Team</p>
                </div>
              </div>

              <div className="bg-black/20 p-4 rounded-md border border-white/5 text-center min-w-[200px]">
                <div className="flex items-center justify-center gap-2 mb-1">
                   <div className={match.status === 'live' ? 'w-2 h-2 bg-green-500 rounded-full animate-pulse' : 'hidden'} />
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">
                    {match.status}
                   </span>
                </div>
                <p className="text-xl md:text-2xl font-mono font-black text-yellow-400">
                  {match.currentScore || '0/0 (0.0 ov)'}
                </p>
                <p className="text-[10px] text-white/50 italic mt-1">{match.statusText || 'Match in progress'}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2">
              <BettingPanel match={enhancedMatch} userId={effectiveUserId} />
            </div>
            <div className="space-y-3">
              <AiInsightBox teamA={match.teamA} teamB={match.teamB} status={match.status} />
              
              <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-4">
                <h3 className="text-[11px] font-black uppercase text-slate-400 mb-4 flex items-center gap-2">
                  <span className="w-1 h-3 bg-primary" />
                  Venue Information
                </h3>
                <div className="space-y-4 text-xs font-bold text-slate-600 uppercase">
                   <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-400">Stadium</span>
                      <span className="truncate max-w-[150px]">{match.venue}</span>
                   </div>
                   <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-400">Series</span>
                      <span className="truncate max-w-[150px]">{match.series}</span>
                   </div>
                   <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-400">Date</span>
                      <span>{format(matchDate, 'dd MMM yyyy')}</span>
                   </div>
                   <div className="flex justify-between">
                      <span className="text-slate-400">Local Time</span>
                      <span>{format(matchDate, 'HH:mm')}</span>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
