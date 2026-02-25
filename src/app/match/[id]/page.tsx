import { db } from '@/lib/db-mock';
import { Sidebar } from '@/components/layout/Sidebar';
import { BettingPanel } from '@/components/betting/BettingPanel';
import { AiInsightBox } from '@/components/betting/AiInsightBox';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin } from 'lucide-react';

export default function MatchPage({ params }: { params: { id: string } }) {
  const match = db.getMatchById(params.id);
  const user = db.getUser();

  if (!match) return notFound();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar tokenBalance={user.tokenBalance} />
      
      <main className="flex-1 lg:pl-64 p-4 lg:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 p-8 rounded-3xl bg-gradient-to-br from-primary/20 via-background to-accent/10 border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              <Badge className={match.status === 'live' ? 'bg-red-500' : ''}>
                {match.status.toUpperCase()}
              </Badge>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-4 lg:gap-12 mb-6">
                <div className="text-center">
                  <h1 className="text-3xl lg:text-5xl font-black mb-2">{match.teamA}</h1>
                  <p className="text-muted-foreground font-medium">HOME</p>
                </div>
                <div className="text-4xl lg:text-6xl font-black text-primary/30 italic">VS</div>
                <div className="text-center">
                  <h1 className="text-3xl lg:text-5xl font-black mb-2">{match.teamB}</h1>
                  <p className="text-muted-foreground font-medium">AWAY</p>
                </div>
              </div>
              
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date(match.startTime).toLocaleDateString()}</span>
                <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> International Stadium</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <BettingPanel match={match} userId={user.id} />
            </div>
            <div className="space-y-6">
              <AiInsightBox teamA={match.teamA} teamB={match.teamB} status={match.status} />
              
              <div className="glass-card p-6 rounded-2xl">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-accent rounded-full" />
                  Match Highlights
                </h3>
                <div className="space-y-4 text-sm text-muted-foreground">
                  <p>• Recent head-to-head: {match.teamA} won 3 of last 5.</p>
                  <p>• Pitch conditions: Dry and favorable for spinners.</p>
                  <p>• Weather: Clear skies, 28°C.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}