'use client';

import { useFirestore, useUser, useDoc, useCollection, useAuth } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { Sidebar } from '@/components/layout/Sidebar';
import { 
  UserCircle, Loader2, Search, Download, HelpCircle, Trophy, ChevronDown 
} from 'lucide-react';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { useState } from 'react';
import { logout } from '@/firebase/auth/auth-service';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { MatchRow } from '@/components/dashboard/MatchRow';
import { SyncDataButton } from '@/components/dashboard/SyncDataButton';
import { GamesGrid } from '@/components/dashboard/GamesGrid';

export default function Dashboard() {
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { user } = useUser();
  const [activeNav, setActiveNav] = useState('CRICKET');
  
  const effectiveUserId = user?.uid || 'guest';

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userData } = useDoc(userRef);

  const matchesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'matches');
  }, [firestore]);
  const { data: matches, loading: matchesLoading } = useCollection(matchesQuery);

  const handleLogout = async () => {
    if (auth) await logout(auth);
    router.push('/login');
  };

  const navItems = ['HOME', 'LOTTERY', 'CRICKET', 'TENNIS', 'FOOTBALL', 'TABLE TENNIS', 'BACCARAT', '32 CARDS', 'TEENPATTI', 'POKER', 'LUCKY 7'];

  return (
    <div className="flex min-h-screen bg-[#f1f5f9]">
      <Sidebar userId={effectiveUserId} />
      
      <main className="flex-1 lg:pl-[200px] flex flex-col">
        {/* Top Branding Header */}
        <header className="exchange-header h-14">
          <div className="flex items-center gap-4">
            <Link href="/">
               <h1 className="text-5xl font-black italic tracking-tighter text-white">ALL</h1>
            </Link>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-white text-[10px] font-bold">
              <div className="flex items-center gap-1 cursor-pointer hover:underline">
                <Search size={14} /> Rules
              </div>
              <div className="flex items-center gap-1 cursor-pointer hover:underline">
                <Download size={14} /> Download Apk
              </div>
            </div>
            
            <div className="flex flex-col items-end text-white leading-tight">
              <div className="text-[11px] font-bold flex gap-2">
                <span>Balance: <span className="text-white font-black">{userData?.tokenBalance?.toFixed(1) || '0.0'}</span></span>
                <span>Exp: <span className="text-white font-black">0</span></span>
              </div>
              <div className="text-[11px] font-bold flex items-center gap-1 cursor-pointer" onClick={handleLogout}>
                <span>{userData?.username || 'User'}</span>
                <ChevronDown size={12} />
              </div>
            </div>
          </div>
        </header>

        {/* Main Nav Bar */}
        <nav className="exchange-nav no-scrollbar overflow-x-auto">
          {navItems.map(item => (
            <button 
              key={item} 
              onClick={() => setActiveNav(item)}
              className={cn(
                "px-3 h-full flex items-center whitespace-nowrap transition-colors",
                activeNav === item ? "bg-[#0072b1] text-white" : "hover:bg-white/10 text-white/80"
              )}
            >
              {item}
            </button>
          ))}
          <div className="ml-auto pr-4 flex items-center gap-2">
            <SyncDataButton />
          </div>
        </nav>

        {/* Event Ticker Sub-Nav */}
        <div className="exchange-sub-nav no-scrollbar overflow-x-auto">
          {matches?.slice(0, 5).map((m: any) => (
            <div key={m.id} className="flex items-center gap-1 px-3 border-r border-white/10 whitespace-nowrap cursor-pointer hover:bg-white/5 h-full">
              <Trophy size={10} className="text-accent" />
              <span>{m.teamA} v {m.teamB}</span>
            </div>
          ))}
        </div>

        {/* Tab Selection Filter */}
        <div className="bg-[#e2e8f0] flex items-center h-8 px-1">
          {['Cricket', 'Football', 'Tennis', 'Table Tennis', 'Esoccer', 'Horse Racing', 'Greyhound Racing'].map(tab => (
            <button key={tab} className={cn(
              "px-3 h-7 text-[10px] font-bold flex items-center justify-center rounded-sm mx-0.5",
              tab === 'Cricket' ? "bg-secondary text-white" : "text-slate-700 hover:bg-slate-200"
            )}>
              {tab}
            </button>
          ))}
        </div>

        {/* Main Market List */}
        <div className="flex-1 p-0.5">
          <div className="bg-[#f8fafc] border border-slate-200">
            <div className="flex items-center h-8 bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
               <div className="flex-1 px-4">Game</div>
               <div className="w-[288px] flex">
                 <div className="flex-1 text-center">1</div>
                 <div className="flex-1 text-center">X</div>
                 <div className="flex-1 text-center">2</div>
               </div>
            </div>

            <div className="divide-y divide-slate-100 min-h-[500px]">
              {matchesLoading ? (
                <div className="p-20 text-center flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-primary" size={24} />
                  <p className="text-[10px] font-bold uppercase text-slate-400">Loading Markets...</p>
                </div>
              ) : matches && matches.length > 0 ? (
                matches.map((match: any) => (
                  <MatchRow key={match.id} match={match} />
                ))
              ) : (
                <div className="p-20 text-center text-slate-400 text-[11px] font-bold italic">No active matches found.</div>
              )}
            </div>
          </div>

          {/* Bottom Thumbnails */}
          <div className="mt-1">
            <GamesGrid />
          </div>
        </div>
      </main>
    </div>
  );
}
