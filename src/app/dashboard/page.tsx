'use client';

import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Sidebar } from '@/components/layout/Sidebar';
import { 
  Loader2, Search, UserCircle, 
  Zap, ShieldCheck, Database, RefreshCw, Globe, AlertTriangle
} from 'lucide-react';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { parseISO, isToday, isAfter, startOfToday } from 'date-fns';
import { useEffect, useState } from 'react';
import { logout } from '@/firebase/auth/auth-service';
import { useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { SyncDataButton } from '@/components/dashboard/SyncDataButton';

export default function Dashboard() {
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { user } = useUser();
  const [activeNav, setActiveNav] = useState('Home');
  
  const effectiveUserId = user?.uid || 'guest';

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userData } = useDoc(userRef);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'app_settings', 'global');
  }, [firestore]);
  const { data: settings } = useDoc(settingsRef);

  // Background sync is REMOVED per user request

  const handleLogout = async () => {
    if (auth) await logout(auth);
    router.push('/login');
  };

  // Matches are filtered out to be empty for "remove all matches" request
  const filteredMatches = []; 

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
            {userData?.role === 'admin' && (
              <div className="flex items-center gap-2">
                <div className="text-[10px] bg-white/10 px-2 py-1 rounded flex items-center gap-1 text-white/50">
                  <ShieldCheck size={10} /> SYNC OFFLINE
                </div>
                <SyncDataButton />
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
              <Zap size={10} className="fill-yellow-400 text-yellow-400" /> System Note
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[11px] whitespace-nowrap">
                Real-world data synchronization is currently paused. No active matches are being displayed.
              </p>
            </div>
          </div>
        </div>

        <div className="p-1 md:p-3">
          <div className="bg-slate-100 border border-slate-200 flex items-center px-4 py-1 text-[10px] font-bold text-slate-500 uppercase">
            <div className="flex-1">Live Feed (Offline)</div>
          </div>

          <div className="border-x border-slate-200 shadow-sm">
            <div className="p-20 text-center flex flex-col items-center gap-4 bg-white border-b border-slate-200">
              <Database size={40} className="text-slate-200" />
              <div className="space-y-1">
                <p className="text-sm font-black uppercase text-slate-400">Terminal Empty</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Syncing is disabled. No matches are currently available.
                </p>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-auto p-4 border-t border-slate-200 bg-white">
          <div className="flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 opacity-50">
            <Globe size={10} />
            Data Connection: Paused
          </div>
        </footer>
      </main>
    </div>
  );
}
