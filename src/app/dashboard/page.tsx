'use client';

import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Sidebar } from '@/components/layout/Sidebar';
import { MatchRow } from '@/components/dashboard/MatchRow';
import { GamesGrid } from '@/components/dashboard/GamesGrid';
import { SyncDataButton } from '@/components/dashboard/SyncDataButton';
import { 
  Loader2, Search, UserCircle, 
  Zap, ShieldCheck, Database, RefreshCw
} from 'lucide-react';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { parseISO, isToday, isAfter, startOfToday } from 'date-fns';
import { useEffect, useState } from 'react';
import { syncCricketMatchesAction } from '@/app/actions/sync-matches';
import { logout } from '@/firebase/auth/auth-service';
import { useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function Dashboard() {
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { user } = useUser();
  const [syncing, setSyncing] = useState(false);
  const [activeNav, setActiveNav] = useState('Home');
  
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

  // Background Sync (Only for Admin)
  useEffect(() => {
    if (!firestore || !userData || userData.role !== 'admin') return;
    const performSync = async () => {
      setSyncing(true);
      await syncCricketMatchesAction(firestore);
      setSyncing(false);
    };
    const intervalId = setInterval(performSync, 60000); // Background sync every 60s
    performSync();
    return () => clearInterval(intervalId);
  }, [firestore, userData]);

  const handleLogout = async () => {
    if (auth) await logout(auth);
    router.push('/login');
  };

  const todayStart = startOfToday();
  const baseActiveMatches = (matches || []).filter(m => {
    if (!m.startTime) return false;
    const matchTime = parseISO(m.startTime);
    // Show live, upcoming, or matches that finished today
    if (m.status === 'finished' && !isToday(matchTime)) return false;
    return isToday(matchTime) || isAfter(matchTime, todayStart);
  });

  // Navigation Filter Logic
  const filteredMatches = baseActiveMatches.filter(m => {
    if (activeNav === 'In-Play') return m.status === 'live';
    if (activeNav === 'Multi Markets') return m.status === 'live' || m.status === 'upcoming';
    return true; // Home or Cricket (show all)
  });

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] text-slate-900">
      <Sidebar userId={effectiveUserId} />
      
      <main className="flex-1 lg:pl-[240px] flex flex-col">
        {/* Top Header - Blue */}
        <header className="exchange-header h-12">
          <div className="flex items-center gap-4">
            <Link href="/">
               <h1 className="text-2xl font-black italic tracking-tighter">ALL</h1>
            </Link>
            <div className="hidden md:flex items-center gap-2 bg-white/10 rounded px-2 py-1 text-[10px]">
              <Search size={14} className="opacity-70" />
              <span>Search Matches</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {userData?.role === 'admin' && (
              <div className="flex items-center gap-2">
                <SyncDataButton />
                <div className={cn(
                  "text-[10px] bg-white/20 px-2 py-1 rounded flex items-center gap-1 text-white transition-all",
                  syncing && "bg-accent/40 animate-pulse"
                )}>
                  {syncing ? <RefreshCw size={10} className="animate-spin" /> : <ShieldCheck size={10} />}
                  {syncing ? 'UPDATING WEB...' : 'NETWORK LIVE'}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <span className="opacity-80">Balance:</span>
              <span className="text-yellow-400">
                {userData?.role === 'admin' ? 'UNLIMITED' : (userData?.tokenBalance || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-white opacity-70 cursor-pointer hover:opacity-100" onClick={handleLogout}>
              <UserCircle size={16} />
              <span>{userData?.username || 'User'}</span>
            </div>
          </div>
        </header>

        {/* Main Nav - Dark (Cricket Focused) */}
        <nav className="exchange-nav">
          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar h-full">
            {['Home', 'Cricket', 'In-Play', 'Multi Markets'].map(item => (
              <button 
                key={item} 
                onClick={() => setActiveNav(item)}
                className={cn(
                  "cursor-pointer hover:text-accent whitespace-nowrap transition-all px-1 h-full text-[11px] font-bold uppercase flex items-center border-b-2",
                  activeNav === item ? "text-accent border-accent" : "text-white/70 border-transparent"
                )}
              >
                {item}
              </button>
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
                {activeNav === 'In-Play' 
                  ? 'Showing all matches currently being played live globally.' 
                  : 'Welcome to the premium exchange. All matches synced with real-time web providers.'}
              </p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-1 md:p-3">
          {/* Match Table Header */}
          <div className="bg-slate-100 border border-slate-200 flex items-center px-4 py-1 text-[10px] font-bold text-slate-500 uppercase">
            <div className="flex-1">Match Event ({activeNav})</div>
            <div className="w-[180px] flex justify-around text-center">
              <div className="w-12">1</div>
              <div className="w-12">X</div>
              <div className="w-12">2</div>
            </div>
          </div>

          {/* Match List */}
          <div className="border-x border-slate-200 shadow-sm">
            {matchesLoading ? (
              <div className="p-20 flex flex-col items-center gap-3 bg-white">
                <Loader2 className="animate-spin text-primary" size={32} />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Connecting to Markets</span>
              </div>
            ) : filteredMatches.length > 0 ? (
              filteredMatches.map(match => (
                <MatchRow key={match.id} match={match} />
              ))
            ) : (
              <div className="p-20 text-center flex flex-col items-center gap-4 bg-white border-b border-slate-200">
                <Database size={40} className="text-slate-200" />
                <div className="space-y-1">
                  <p className="text-sm font-black uppercase text-slate-400">No Match Data Found</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {userData?.role === 'admin' 
                      ? 'Please use the "Refresh Actual Web" button to sync your first set of matches.' 
                      : 'No matches are currently live or scheduled in this category.'}
                  </p>
                </div>
                {userData?.role === 'admin' && (
                  <div className="pt-4">
                    <SyncDataButton />
                  </div>
                )}
              </div>
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
