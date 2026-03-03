
'use client';

import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { Sidebar } from '@/components/layout/Sidebar';
import { Loader2, Star, UserCircle, Globe, Trophy, ArrowRight } from 'lucide-react';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { syncCricketMatchesAction } from '@/app/actions/sync-matches';
import { useEffect } from 'react';

export default function TournamentsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const effectiveUserId = user?.uid || 'guest';

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userData } = useDoc(userRef);

  const tournamentsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'tournaments'));
  }, [firestore]);
  const { data: tournaments, loading } = useCollection(tournamentsQuery);

  useEffect(() => {
    if (firestore) syncCricketMatchesAction(firestore);
  }, [firestore]);

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
            <Link href="/dashboard" className="text-white/70 hover:text-white transition-all text-[11px] font-bold uppercase">Dashboard</Link>
            <span className="text-accent border-b-2 border-accent h-full flex items-center text-[11px] font-bold uppercase">Tournaments</span>
          </div>
        </nav>

        <div className="p-3 max-w-5xl mx-auto w-full">
          <div className="mb-8 mt-4">
            <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-2">Tournament Hub</h2>
            <p className="text-slate-500 text-sm font-medium">Place long-term stakes on outright winners of major cricket series and leagues.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              <div className="col-span-full py-20 text-center">
                <Loader2 className="animate-spin text-primary mx-auto mb-4" size={32} />
                <p className="text-[10px] font-bold uppercase text-slate-400">Syncing Major Leagues...</p>
              </div>
            ) : tournaments && tournaments.length > 0 ? (
              tournaments.map((t: any) => (
                <Link key={t.id} href={`/tournament/${t.id}`}>
                  <div className="bg-white border border-slate-200 rounded-sm p-5 hover:border-primary/50 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Trophy size={80} />
                    </div>
                    <div className="flex justify-between items-start mb-4">
                      <Badge variant="outline" className="text-[9px] border-primary/20 text-primary uppercase font-black">{t.category}</Badge>
                      <Star size={16} className="text-yellow-400 fill-yellow-400" />
                    </div>
                    <h3 className="text-xl font-black italic tracking-tighter uppercase text-slate-800 mb-1 leading-tight">{t.name}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">{t.gender}'s {t.type}</p>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                      <span className="text-[10px] font-black uppercase text-primary">Outright Winner Available</span>
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-all">
                        <ArrowRight size={16} />
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-lg">
                <Globe size={40} className="mx-auto text-slate-200 mb-4" />
                <p className="text-sm font-black uppercase text-slate-400">No Active Tournaments Found</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase">The terminal is currently scanning for major series.</p>
              </div>
            )}
          </div>
        </div>

        <footer className="mt-auto p-4 border-t border-slate-200 bg-white">
          <div className="flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 opacity-50">
            <Globe size={10} /> Professional Network Pulse Active
          </div>
        </footer>
      </main>
    </div>
  );
}
