'use client';

import { useParams } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { Trophy, Search, UserCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const MOCK_STANDINGS: Record<string, any[]> = {
  international: [
    { pos: 1, team: 'India', p: 8, w: 7, l: 1, pts: 14, nrr: '+1.562' },
    { pos: 2, team: 'Australia', p: 8, w: 6, l: 2, pts: 12, nrr: '+1.102' },
    { pos: 3, team: 'South Africa', p: 8, w: 5, l: 3, pts: 10, nrr: '+0.890' },
    { pos: 4, team: 'England', p: 8, w: 4, l: 4, pts: 8, nrr: '+0.231' },
    { pos: 5, team: 'New Zealand', p: 8, w: 4, l: 4, pts: 8, nrr: '-0.120' },
  ],
  t20: [
    { pos: 1, team: 'Mumbai Indians', p: 14, w: 10, l: 4, pts: 20, nrr: '+0.562' },
    { pos: 2, team: 'Chennai Super Kings', p: 14, w: 9, l: 5, pts: 18, nrr: '+0.402' },
    { pos: 3, team: 'Kolkata Knight Riders', p: 14, w: 8, l: 6, pts: 16, nrr: '+0.390' },
    { pos: 4, team: 'Royal Challengers', p: 14, w: 7, l: 7, pts: 14, nrr: '+0.131' },
  ],
  test: [
    { pos: 1, team: 'Australia', p: 12, w: 8, l: 2, d: 2, pts: 96, pct: '66.6%' },
    { pos: 2, team: 'India', p: 11, w: 7, l: 3, d: 1, pts: 84, pct: '63.6%' },
    { pos: 3, team: 'England', p: 14, w: 6, l: 6, d: 2, pts: 72, pct: '42.8%' },
  ],
  odi: [
    { pos: 1, team: 'Pakistan', p: 10, w: 8, l: 2, pts: 16, nrr: '+1.200' },
    { pos: 2, team: 'India', p: 10, w: 7, l: 3, pts: 14, nrr: '+0.950' },
    { pos: 3, team: 'South Africa', p: 10, w: 6, l: 4, pts: 12, nrr: '+0.450' },
  ],
};

const CATEGORY_NAMES: Record<string, string> = {
  international: 'International Rankings',
  t20: 'T20 League Standings',
  test: 'WTC Test Standings',
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

  const standings = MOCK_STANDINGS[type as string] || [];
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
              <Zap size={10} className="fill-yellow-400 text-yellow-400" /> Stats Centre
            </div>
            <p className="text-[11px] text-slate-500 italic">Official points table and standings as per latest web data sync.</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-3">
          <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
            <div className="bg-[#2c3e50] text-white px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <Trophy size={14} className="text-accent" /> {title} - 2024/25 Season
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 font-black uppercase tracking-tighter h-10">
                    <th className="px-4 w-12 text-center">POS</th>
                    <th className="px-4">TEAM / SQUAD</th>
                    <th className="px-4 text-center">P</th>
                    <th className="px-4 text-center">W</th>
                    <th className="px-4 text-center">L</th>
                    {type === 'test' ? (
                      <>
                        <th className="px-4 text-center">D</th>
                        <th className="px-4 text-center">PTS</th>
                        <th className="px-4 text-center">PCT</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 text-center">PTS</th>
                        <th className="px-4 text-center">NRR</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {standings.map((team, idx) => (
                    <tr key={team.team} className={cn(
                      "h-12 hover:bg-slate-50 transition-colors",
                      idx < 4 && "bg-accent/5"
                    )}>
                      <td className="px-4 text-center font-bold text-slate-400">{team.pos}</td>
                      <td className="px-4 font-black uppercase italic tracking-tighter text-slate-700">{team.team}</td>
                      <td className="px-4 text-center font-bold">{team.p}</td>
                      <td className="px-4 text-center text-green-600 font-bold">{team.w}</td>
                      <td className="px-4 text-center text-red-500 font-bold">{team.l}</td>
                      {type === 'test' ? (
                        <>
                          <td className="px-4 text-center">{team.d}</td>
                          <td className="px-4 text-center font-black text-primary">{team.pts}</td>
                          <td className="px-4 text-center font-bold text-accent">{team.pct}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 text-center font-black text-primary">{team.pts}</td>
                          <td className="px-4 text-center font-mono text-slate-500">{team.nrr}</td>
                        </>
                      )}
                    </tr>
                  ))}
                  {standings.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-12 text-center text-slate-400 italic">No standings data available for this category.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="bg-slate-50 p-4 border-t border-slate-200">
              <div className="flex items-center gap-6 text-[10px] text-slate-400 font-bold uppercase">
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-accent/20 rounded-sm" /> Qualification Zone</div>
                <div>P: Played</div>
                <div>W: Won</div>
                <div>L: Lost</div>
                <div>NRR: Net Run Rate</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
