'use client';

import { useFirestore, useCollection, useUser } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Sidebar } from '@/components/layout/Sidebar';
import { MatchCard } from '@/components/dashboard/MatchCard';
import { Trophy, Loader2, Radio } from 'lucide-react';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { SyncDataButton } from '@/components/dashboard/SyncDataButton';

export default function Dashboard() {
  const firestore = useFirestore();
  const { user, loading: userLoading } = useUser();
  
  const matchesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'matches');
  }, [firestore]);

  const { data: matches, loading: matchesLoading } = useCollection(matchesQuery);

  if (userLoading || matchesLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const liveMatches = matches?.filter(m => m.status === 'live') || [];
  const upcomingMatches = matches?.filter(m => m.status === 'upcoming') || [];
  const finishedMatches = matches?.filter(m => m.status === 'finished') || [];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar userId={user?.uid} />
      
      <main className="flex-1 lg:pl-64 p-4 lg:p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold font-headline mb-2 flex items-center gap-2">
              Match Center
            </h1>
            <p className="text-muted-foreground text-sm">Real-time data synchronization active.</p>
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

        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <Radio className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-bold uppercase tracking-widest">Upcoming Fixtures</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {upcomingMatches.map(match => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>

        {finishedMatches.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-xl font-bold uppercase tracking-widest text-muted-foreground">Results</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-70">
              {finishedMatches.map(match => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </section>
        )}

        {upcomingMatches.length === 0 && liveMatches.length === 0 && finishedMatches.length === 0 && (
          <div className="glass-card p-12 text-center rounded-3xl">
            <p className="text-muted-foreground italic">No matches synced yet. Click "Refresh Live Scores" to pull real data.</p>
          </div>
        )}
      </main>
    </div>
  );
}
