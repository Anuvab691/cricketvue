'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useUser, useAuth } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { Sidebar } from '@/components/layout/Sidebar';
import { BettingPanel } from '@/components/betting/BettingPanel';
import { AiInsightBox } from '@/components/betting/AiInsightBox';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserCircle, Zap, ShieldCheck, ChevronLeft } from 'lucide-react';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { format, parseISO } from 'date-fns';
import { logout } from '@/firebase/auth/auth-service';
import Link from 'next/link';

export default function MatchPage() {
  const { id } = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const auth = useAuth();
  const { user } = useUser();
  
  const effectiveUserId = user?.uid || 'guest';

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userData } = useDoc(userRef);

  const matchRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'matches', id as string);
  }, [firestore, id]);

  const marketsQuery = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return collection(firestore, 'matches', id as string, 'markets');
  }, [firestore, id]);

  const { data: match, loading: matchLoading } = useDoc(matchRef);
  const { data: markets, loading: marketsLoading } = useCollection(marketsQuery);

  const handleLogout = async () => {
    if (auth) await logout(auth);
    router.push('/login');
  };

  if (matchLoading || marketsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8f9fa]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#f8f9fa] gap-4">
        <p className="text-slate-500 font-bold uppercase tracking-widest">Match Record Not Found</p>
        <Link href="/dashboard">
          <button className="bg-primary text-white px-6 py-2 rounded-sm font-bold text-xs uppercase">Return to Dashboard</button>
        </Link>
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
            {userData?.role === 'admin' && (
              <div className="text-[10px] bg-white/20 px-2 py-0.5 rounded flex items-center gap-1">
                <ShieldCheck size={10} /> Live Data Sync Active
              </div>
            )}
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
              <Zap size={10} className="fill-yellow-400 text-yellow-400" /> Match Event
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
                      <span>{match.venue}</span>
                   </div>
                   <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-400">Series</span>
                      <span>{match.series}</span>
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
