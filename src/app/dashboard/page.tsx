'use client';

import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Sidebar } from '@/components/layout/Sidebar';
import { MatchRow } from '@/components/dashboard/MatchRow';
import { GamesGrid } from '@/components/dashboard/GamesGrid';
import { 
  Loader2, Search, UserCircle, 
  Zap, ShieldCheck 
} from 'lucide-react';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { parseISO, isToday, isAfter, startOfToday } from 'date-fns';
import { useEffect, useState } from 'react';
import { syncCricketMatchesAction } from '@/app/actions/sync-matches';
import { logout } from '@/firebase/auth/auth-service';
import { useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { user } = useUser();
  const [syncing, setSyncing] = useState(false);
  
  const effectiveUserId = user?.uid || 'guest';

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userData } = useDoc(userRef);

  const matchesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'matches'), orderBy('startTime', 'asc'));
  }, [firestore]);

  const { data: matches, loading: matchesLoading } = useCollection(matchesQuery);

  useEffect(() => {
    if (!firestore || !userData || userData.role !== 'admin') return;
    const performSync = async () => {
      setSyncing(true);
      await syncCricketMatchesAction(firestore);
      setSyncing(false);
    };
    const intervalId = setInterval(performSync, 15000);
    performSync();
    return () => clearInterval(intervalId);
  }, [firestore, userData]);

  const handleLogout = async () => {
    if (auth) await logout(auth);
    router.push('/login');
  };

  const todayStart = startOfToday();
  const activeMatches = (matches || []).filter(m => {
    if (!m.startTime) return false;
    const matchTime = parseISO(m.startTime);
    if (m.status === 'finished' && !isToday(matchTime)) return false;
    return isToday(matchTime) || isAfter(matchTime, todayStart);
  });

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] text-slate-900">
      <Sidebar userId={effectiveUserId} />
      
      <main className="flex-1 lg:pl-[240px] flex flex-col">
        {/* Top Header - Blue */}
        <header className="exchange-header h-12">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-black italic tracking-tighter">ALL</h1>
            <div className="hidden md:flex items-center gap-2 bg-white/10 rounded px-2 py-1 text-[10px]">
              <Search size={14} className="opacity-70" />
              <span>Search Matches</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {userData?.role === 'admin' && (
              <div className="text-[10px] bg-white/20 px-2 py-0.5 rounded flex items-center gap-1">
                <ShieldCheck size={10} /> {syncing ? 'Syncing...' : 'Live'}
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

        {/* Main Nav - Dark (Cricket Focused) */}
        <nav className="exchange-nav">
          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
            {['Home', 'Cricket', 'In-Play', 'Multi Markets'].map(item => (
              <span key={item} className={cn("cursor-pointer hover:text-accent whitespace-nowrap", item === 'Cricket' && "text-accent border-b-2 border-accent")}>
                {item}
              </span>
            ))}
          </div>
        </nav>

        {/* Sub Nav - Ticker Style */}
        <div className="exchange-sub-nav">
          <div className="flex items-center gap-4 w-full">
            <div className="bg-slate-800 text-white px-2 py-1 rounded text-[10px] flex items-center gap-1 shrink-0">
              <Zap size={10} className="fill-yellow-400 text-yellow-400" /> Live News
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[11px] whitespace-nowrap animate-pulse">
                Upcoming: Champions Trophy 2025 schedules announced. Stay tuned for live betting markets!
              </p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-1 md:p-3">
          {/* Sports Category Tabs (Simplified to Cricket only) */}
          <div className="flex bg-[#e9ecef] p-0.5 rounded-sm mb-2 overflow-x-auto no-scrollbar">
            {['Cricket'].map(sport => (
              <button 
                key={sport} 
                className={cn(
                  "px-6 py-1.5 text-[10px] font-bold rounded-sm whitespace-nowrap",
                  sport === 'Cricket' ? "bg-[#2c3e50] text-white" : "text-slate-600 hover:bg-slate-200"
                )}
              >
                {sport}
              </button>
            ))}
          </div>

          {/* Match Table Header */}
          <div className="bg-slate-100 border border-slate-200 flex items-center px-4 py-1 text-[10px] font-bold text-slate-500 uppercase">
            <div className="flex-1">Match Event</div>
            <div className="w-[180px] flex justify-around text-center">
              <div className="w-12">1</div>
              <div className="w-12">X</div>
              <div className="w-12">2</div>
            </div>
          </div>

          {/* Match List */}
          <div className="border-x border-slate-200">
            {matchesLoading ? (
              <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
            ) : activeMatches.length > 0 ? (
              activeMatches.map(match => (
                <MatchRow key={match.id} match={match} />
              ))
            ) : (
              <div className="p-12 text-center text-xs text-slate-400 bg-white">No active cricket matches found.</div>
            )}
          </div>

          {/* Games Grid Section (Cricket Focused) */}
          <div className="mt-6">
            <h3 className="text-xs font-bold uppercase text-slate-400 mb-3 px-1">Cricket Specials</h3>
            <GamesGrid />
          </div>
        </div>
      </main>
    </div>
  );
}
