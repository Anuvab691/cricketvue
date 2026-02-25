
'use client';

import { useFirestore, useCollection, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Sidebar } from '@/components/layout/Sidebar';
import { MatchCard } from '@/components/dashboard/MatchCard';
import { Trophy, Loader2 } from 'lucide-react';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';

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

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar userId={user?.uid} />
      
      <main className="flex-1 lg:pl-64 p-8">
        <header className="mb-10">
          <h1 className="text-3xl font-bold font-headline mb-2">Match Center</h1>
          <p className="text-muted-foreground">Catch the latest live action and prepare your predictions.</p>
        </header>

        {liveMatches.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
              <h2 className="text-xl font-bold uppercase tracking-widest">Live Now</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {liveMatches.map(match => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center gap-3 mb-6">
            <Trophy className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-bold uppercase tracking-widest">Upcoming Fixtures</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {upcomingMatches.map(match => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
          {upcomingMatches.length === 0 && liveMatches.length === 0 && (
            <div className="glass-card p-12 text-center rounded-3xl">
              <p className="text-muted-foreground italic">No matches scheduled at the moment. Check back soon!</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
