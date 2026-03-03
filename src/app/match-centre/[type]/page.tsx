'use client';

import { useParams } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { useUser, useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { Trophy, Zap, UserCircle, Loader2, PlayCircle, Database, RefreshCw, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format, parseISO, isToday, isAfter, startOfToday } from 'date-fns';
import { useEffect, useState } from 'react';

const CATEGORY_NAMES: Record<string, string> = {
  international: 'International Series',
  t20: 'T20 League Matches',
  test: 'Test Match Centre',
  odi: 'ODI Championship',
};

export default function MatchCentrePage() {
  const { type } = useParams();
  const { user } = useUser();
  const firestore = useFirestore();
  const effectiveUserId = user?.uid || 'guest';

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userData } = useDoc(userRef);

  // Background sync is REMOVED per user request

  const filteredMatches = []; // Matches are filtered out to be empty per request

  const title = CATEGORY_NAMES[type as string] || 'Match Centre';

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
            <div className="text-[10px] bg-white/10 px-2 py-1 rounded flex items-center gap-1 text-white/50">
              <Zap size={10} /> SYNC OFFLINE
            </div>
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

        <nav className="exchange-nav">
          <div className="flex items-center gap-6 h-full">
            <Link href="/dashboard" className="text-white/70 hover:text-white transition-all text-[11px] font-bold uppercase">
              Dashboard
            </Link>
            <span className="text-accent border-b-2 border-accent h-full flex items-center text-[11px] font-bold uppercase">
              {title}
            </span>
          </div>
        </nav>

        <div className="exchange-sub-nav">
          <div className="flex items-center gap-4 w-full">
            <div className="bg-slate-800 text-white px-2 py-1 rounded text-[10px] flex items-center gap-1 shrink-0">
              <Zap size={10} /> Information
            </div>
            <p className="text-[11px] text-slate-500 font-bold">The match terminal is currently in offline mode.</p>
          </div>
        </div>

        <div className="p-1 md:p-3">
          <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
            <div className="bg-[#2c3e50] text-white px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy size={14} className="text-accent" /> {title} - Fixtures Unavailable
              </div>
            </div>
            
            <div className="p-20 text-center flex flex-col items-center gap-4">
              <Database size={40} className="text-slate-200" />
              <div className="space-y-1">
                <p className="text-sm font-black uppercase text-slate-400">No Data Available</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Real-time match synchronization has been disabled.
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
