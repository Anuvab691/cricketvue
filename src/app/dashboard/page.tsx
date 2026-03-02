'use client';

import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { Sidebar } from '@/components/layout/Sidebar';
import { MatchCard } from '@/components/dashboard/MatchCard';
import { Loader2, Zap, CalendarDays, Clock, LayoutGrid, Radio } from 'lucide-react';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { isToday, isTomorrow, parseISO, compareAsc, format, isAfter, startOfToday } from 'date-fns';
import { useEffect } from 'react';
import { syncCricketMatchesAction } from '@/app/actions/sync-matches';

export default function Dashboard() {
  const firestore = useFirestore();
  const { user } = useUser();
  
  const effectiveUserId = user?.uid || 'guest-user-123';

  // Fetch current user data to check for admin status
  const userRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userData } = useDoc(userRef);

  const matchesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'matches'), orderBy('startTime', 'asc'));
  }, [firestore]);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'app_settings', 'global');
  }, [firestore]);

  const { data: matches, loading: matchesLoading } = useCollection(matchesQuery);
  const { data: settings } = useDoc(settingsRef);

  // Automatic Background Synchronization
  // Only the Admin or an authorized user should trigger the writes to avoid race conditions
  useEffect(() => {
    if (!firestore || !userData || userData.role !== 'admin') return;

    const intervalId = setInterval(() => {
      syncCricketMatchesAction(firestore);
    }, 15000); // Sync every 15 seconds for a lively demo feel

    // Initial sync
    syncCricketMatchesAction(firestore);

    return () => clearInterval(intervalId);
  }, [firestore, userData]);

  if (matchesLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const todayStart = startOfToday();
  
  const currentAndFutureMatches = (matches || []).filter(m => {
    if (!m.startTime) return false;
    const matchTime = parseISO(m.startTime);
    if (m.status === 'finished') return false;
    return isToday(matchTime) || isAfter(matchTime, todayStart);
  });

  const sortedMatches = [...currentAndFutureMatches].sort((a, b) => {
    return compareAsc(parseISO(a.startTime), parseISO(b.startTime));
  });

  const liveMatches = sortedMatches.filter(m => m.status === 'live');
  const todayMatches = sortedMatches.filter(m => m.status === 'upcoming' && isToday(parseISO(m.startTime)));
  const tomorrowMatches = sortedMatches.filter(m => m.status === 'upcoming' && isTomorrow(parseISO(m.startTime)));
  const futureMatches = sortedMatches.filter(m => m.status === 'upcoming' && !isToday(parseISO(m.startTime)) && !isTomorrow(parseISO(m.startTime)));

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar userId={effectiveUserId} />
      
      <main className="flex-1 lg:pl-64 p-4 lg:p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold font-headline mb-2 flex items-center gap-2">
              <LayoutGrid className="w-8 h-8 text-primary" />
              Live Match Center
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent rounded-full border border-accent/20">
                <Zap className="w-3 h-3" /> Auto-Updating (Demo Mode)
              </span>
              {settings?.lastGlobalSync && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> 
                  Last Sync: {format(new Date(settings.lastGlobalSync), 'HH:mm:ss')}
                </span>
              )}
            </div>
          </div>
          {/* Refresh button removed for automatic updates */}
        </header>

        {liveMatches.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                <span className="text-xs font-bold text-red-500 uppercase tracking-widest">Live Now</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {liveMatches.map(match => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </section>
        )}

        {todayMatches.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6 border-b border-border/50 pb-4">
              <CalendarDays className="w-5 h-5 text-accent" />
              <h2 className="text-xl font-bold uppercase tracking-tighter italic">Today's Schedule</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {todayMatches.map(match => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </section>
        )}

        {tomorrowMatches.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6 border-b border-border/50 pb-4">
              <Radio className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-xl font-bold uppercase tracking-tighter text-muted-foreground italic">Tomorrow</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tomorrowMatches.map(match => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </section>
        )}

        {futureMatches.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6 border-b border-border/50 pb-4">
              <Clock className="w-5 h-5 text-muted-foreground opacity-50" />
              <h2 className="text-xl font-bold uppercase tracking-tighter text-muted-foreground opacity-50 italic">Upcoming Series</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {futureMatches.map(match => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </section>
        )}

        {sortedMatches.length === 0 && (
          <div className="glass-card p-20 text-center rounded-3xl border-dashed border-white/5">
            <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2">No Active or Upcoming Matches</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">Connecting to global servers... live data will appear automatically.</p>
          </div>
        )}
      </main>
    </div>
  );
}
