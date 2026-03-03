'use client';

import { useParams } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { useUser, useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { Trophy, Zap, UserCircle, Loader2, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';

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

  const matchesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'matches'), orderBy('startTime', 'desc'));
  }, [firestore]);

  const { data: matches, loading: matchesLoading } = useCollection(matchesQuery);

  const filteredMatches = (matches || []).filter(m => {
    if (type === 'international') return true; // Show all for international/global view
    return m.matchType?.toLowerCase() === (type as string).toLowerCase();
  });

  const title = CATEGORY_NAMES[type as string] || 'Match Centre';

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

        {/* Sub Nav */}
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

        {/* Ticker */}
        <div className="exchange-sub-nav">
          <div className="flex items-center gap-4 w-full">
            <div className="bg-slate-800 text-white px-2 py-1 rounded text-[10px] flex items-center gap-1 shrink-0">
              <Zap size={10} className="fill-yellow-400 text-yellow-400" /> Live Terminal
            </div>
            <p className="text-[11px] text-slate-500 italic">Showing matches from the actual web data sync for {title}.</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-3">
          <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
            <div className="bg-[#2c3e50] text-white px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <Trophy size={14} className="text-accent" /> {title} - Current Fixtures
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 font-black uppercase tracking-tighter h-10">
                    <th className="px-4">Match Event</th>
                    <th className="px-4">Series / League</th>
                    <th className="px-4 text-center">Date & Time</th>
                    <th className="px-4 text-center">Status</th>
                    <th className="px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matchesLoading ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center">
                        <Loader2 className="animate-spin mx-auto text-primary" size={24} />
                      </td>
                    </tr>
                  ) : filteredMatches.length > 0 ? (
                    filteredMatches.map((match) => (
                      <tr key={match.id} className="h-14 hover:bg-slate-50 transition-colors">
                        <td className="px-4">
                          <div className="flex flex-col">
                            <span className="font-black uppercase italic tracking-tighter text-slate-800 text-sm">{match.teamA} v {match.teamB}</span>
                            <span className="text-[10px] text-primary font-mono font-bold">{match.currentScore}</span>
                          </div>
                        </td>
                        <td className="px-4 font-bold text-slate-500 uppercase">{match.series}</td>
                        <td className="px-4 text-center text-slate-400 font-bold">
                          {match.startTime ? format(parseISO(match.startTime), 'dd MMM, HH:mm') : 'TBD'}
                        </td>
                        <td className="px-4 text-center">
                          <span className={cn(
                            "text-[9px] font-black uppercase px-2 py-0.5 rounded-sm",
                            match.status === 'live' ? "bg-green-500 text-white animate-pulse" : 
                            match.status === 'finished' ? "bg-slate-200 text-slate-500" : "bg-primary/10 text-primary"
                          )}>
                            {match.status}
                          </span>
                        </td>
                        <td className="px-4 text-right">
                          <Link href={`/match/${match.id}`}>
                            <button className="bg-primary hover:bg-primary/90 text-white px-4 py-1.5 rounded-sm font-black text-[10px] uppercase italic tracking-tighter inline-flex items-center gap-1">
                              <PlayCircle size={10} /> View Markets
                            </button>
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-16 text-center text-slate-400 italic font-bold uppercase tracking-widest">
                        No matches currently synced for this category.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="bg-slate-50 p-4 border-t border-slate-200">
              <div className="flex items-center gap-6 text-[10px] text-slate-400 font-bold uppercase">
                <div className="flex items-center gap-1"><Zap size={10} className="text-accent" /> Data source: Official Web API</div>
                <div>Matches refresh every 15 seconds</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
