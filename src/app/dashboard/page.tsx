'use client';

import { useFirestore, useCollection, useUser } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Sidebar } from '@/components/layout/Sidebar';
import { MatchCard } from '@/components/dashboard/MatchCard';
import { Trophy, Loader2, Radio, Zap, CalendarDays } from 'lucide-react';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { SyncDataButton } from '@/components/dashboard/SyncDataButton';
import { isToday, isTomorrow, parseISO, compareAsc } from 'date-fns';

export default function Dashboard() {
  const firestore = useFirestore();
  const { user } = useUser();
  
  const effectiveUserId = user?.uid || 'guest-user-123';

  const matchesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // Order by startTime so they appear in chronological order
    return query(collection(firestore, 'matches'), orderBy('startTime', 'asc'));
  }, [firestore]);

  const { data: matches, loading: matchesLoading } = useCollection(matchesQuery);

  if (matchesLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const sortedMatches = [...(matches || [])].sort((a, b) => {
    return compareAsc(parseISO(a.startTime), parseISO(b.startTime));
  });

  const liveMatches = sortedMatches.filter(m => m.status === 'live');
  const todayMatches = sortedMatches.filter(m => m.status === 'upcoming' && isToday(parseISO(m.startTime)));
  const tomorrowMatches = sortedMatches.filter(m => m.status === 'upcoming' && isTomorrow(parseISO(m.startTime)));
  const futureMatches = sortedMatches.filter(m => m.status === 'upcoming' && !isToday(parseISO(m.startTime)) && !isTomorrow(parseISO(m.startTime)));
  const finishedMatches = sortedMatches.filter(m => m.status === 'finished').reverse(); // Show recent results first

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar userId={effectiveUserId} />
      
      <main className="flex-1 lg:pl-64 p-4 lg:p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold font-headline mb-2 flex items-center gap-2">
              Match Center
            </h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent rounded-full border border-accent/20">
                <Zap className="w-3 h-3" /> Real-Time Updates
              </span>
              <span>• Worldwide Leagues</span>
            </div>
          </div>
          <SyncDataButton />
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
            <div className="flex items-center gap-3 mb-6">
              <CalendarDays className="w-5 h-5 text-accent" />
              <h2 className="text-xl font-bold uppercase tracking-widest">Today's Fixtures</h2>
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
            <div className="flex items-center gap-3 mb-6">
              <Radio className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-xl font-bold uppercase tracking-widest text-muted-foreground">Tomorrow's Action</h2>
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
            <div className="flex items-center gap-3 mb-6">
              <Radio className="w-5 h-5 text-muted-foreground opacity-50" />
              <h2 className="text-xl font-bold uppercase tracking-widest text-muted-foreground opacity-50">Future Matches</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {futureMatches.map(match => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </section>
        )}

        {finishedMatches.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="w-5 h-5 text-green-500" />
              <h2 className="text-xl font-bold uppercase tracking-widest text-muted-foreground">Recent Results</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-90">
              {finishedMatches.map(match => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </section>
        )}

        {sortedMatches.length === 0 && (
          <div className="glass-card p-12 text-center rounded-3xl">
            <p className="text-muted-foreground italic">No matches synced yet. Click "Refresh Live Scores" to pull current data from the API.</p>
          </div>
        )}
      </main>
    </div>
  );
}
