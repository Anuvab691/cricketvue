
'use client';

import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Sidebar } from '@/components/layout/Sidebar';
import { 
  Loader2, UserCircle, 
  Zap, ShieldCheck, Database, RefreshCw, Globe
} from 'lucide-react';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { useEffect, useState } from 'react';
import { logout } from '@/firebase/auth/auth-service';
import { useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { SyncDataButton } from '@/components/dashboard/SyncDataButton';
import { syncCricketMatchesAction } from '@/app/actions/sync-matches';
import { MatchRow } from '@/components/dashboard/MatchRow';
import { GamesGrid } from '@/components/dashboard/GamesGrid';

export default function Dashboard() {
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { user } = useUser();
  const [activeNav, setActiveNav] = useState('Home');
  const [isSyncing, setIsSyncing] = useState(false);
  
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

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'app_settings', 'global');
  }, [firestore]);
  const { data: settings } = useDoc(settingsRef);

  // Fully Automated Global Sync (10 seconds)
  // This runs for any active user to ensure the network is always live.
  // The action itself handles concurrency protection using a timestamp lock.
  useEffect(() => {
    if (!firestore) return;

    const interval = setInterval(async () => {
      setIsSyncing(true);
      await syncCricketMatchesAction(firestore);
      setIsSyncing(false);
    }, 10000);

    // Immediate initial sync
    syncCricketMatchesAction(firestore);

    return () => clearInterval(interval);
  }, [firestore]);

  const handleLogout = async () => {
    if (auth) await logout(auth);
    router.push('/login');
  };

  const filteredMatches = matches || [];

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] text-slate-900">
      <Sidebar userId={effectiveUserId} />
      
      <main className="flex-1 lg:pl-[240px] flex flex-col">
        <header className="exchange-header h-12">
          <div className="flex items-center gap-4">
            <Link href="/">
               <h1 className="text-2xl font-black italic tracking-tighter">ALL</h1>
            </Link>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={cn(
                "text-[10px] bg-white/10 px-2 py-1 rounded flex items-center gap-1 transition-all",
                isSyncing ? "text-yellow-400 animate-pulse" : "text-white/50"
              )}>
                <ShieldCheck size={10} /> {isSyncing ? 'SYNCING NETWORK...' : 'LIVE DATA'}
              </div>
              {userData?.role === 'admin' && <SyncDataButton />}
            </div>
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

        <div className="exchange-sub-nav">
          <div className="flex items-center gap-4 w-full">
            <div className="bg-slate-800 text-white px-2 py-1 rounded text-[10px] flex items-center gap-1 shrink-0">
              <Zap size={10} className="fill-yellow-400 text-yellow-400" /> Auto-Updates
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[11px] whitespace-nowrap">
                {isSyncing ? 'Synchronizing fresh data from professional source...' : `Last Global Sync: ${settings?.lastGlobalSync ? new Date(settings.lastGlobalSync).toLocaleTimeString() : 'Awaiting pulse'}`}
              </p>
            </div>
          </div>
        </div>

        <div className="p-1 md:p-3">
          <div className="bg-slate-100 border border-slate-200 flex items-center px-4 py-1 text-[10px] font-bold text-slate-500 uppercase">
            <div className="flex-1">Match</div>
            <div className="w-[180px] flex justify-around">
               <span>Winner</span>
               <span>Bookmaker</span>
               <span>Fancy</span>
            </div>
          </div>

          <div className="border-x border-slate-200 shadow-sm">
            {matchesLoading ? (
              <div className="p-20 text-center flex flex-col items-center gap-2 bg-white">
                <Loader2 className="animate-spin text-primary" size={32} />
                <p className="text-[10px] font-bold uppercase text-slate-400">Loading Terminal Data...</p>
              </div>
            ) : filteredMatches.length > 0 ? (
              filteredMatches.map((match: any) => (
                <MatchRow key={match.id} match={match} />
              ))
            ) : (
              <div className="p-20 text-center flex flex-col items-center gap-4 bg-white border-b border-slate-200">
                <Database size={40} className="text-slate-200" />
                <div className="space-y-1">
                  <p className="text-sm font-black uppercase text-slate-400">No Matches Available</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    The terminal is live but no matches met the filter criteria.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3 px-1">
               <ShieldCheck className="text-primary" size={16} />
               <h3 className="text-xs font-black uppercase italic tracking-tight">Exchange Mini Games</h3>
            </div>
            <GamesGrid />
          </div>
        </div>

        <footer className="mt-auto p-4 border-t border-slate-200 bg-white">
          <div className="flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 opacity-50">
            <Globe size={10} />
            Network Data: Automated Synchronization Active
          </div>
        </footer>
      </main>
    </div>
  );
}
