'use client';

import { Match } from '@/lib/db-mock';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, Clock } from 'lucide-react';
import Link from 'next/link';

export function MatchCard({ match }: { match: Match }) {
  const isLive = match.status === 'live';
  
  return (
    <Card className="glass-card overflow-hidden group hover:border-primary/50 transition-all duration-300">
      <CardContent className="p-0">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            {isLive ? (
              <Badge variant="destructive" className="animate-pulse px-3 py-1 text-xs font-bold uppercase tracking-wider">
                Live
              </Badge>
            ) : (
              <Badge variant="secondary" className="px-3 py-1 text-xs font-bold uppercase tracking-wider">
                <Clock className="w-3 h-3 mr-1 inline" />
                {new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Badge>
            )}
            <div className="flex gap-1">
              <TrendingUp className="w-4 h-4 text-accent" />
              <span className="text-xs text-muted-foreground font-medium">High Volume</span>
            </div>
          </div>

          <div className="flex justify-between items-center mb-8">
            <div className="text-center flex-1">
              <p className="text-xl font-bold mb-1">{match.teamA}</p>
              <p className="text-xs text-muted-foreground">Team Host</p>
            </div>
            <div className="px-4 text-primary font-black italic">VS</div>
            <div className="text-center flex-1">
              <p className="text-xl font-bold mb-1">{match.teamB}</p>
              <p className="text-xs text-muted-foreground">Away Team</p>
            </div>
          </div>

          <Link href={`/match/${match.id}`}>
            <Button className="w-full bg-primary hover:bg-primary/90 rounded-xl py-6 font-bold text-lg group-hover:scale-[1.02] transition-transform">
              View Markets
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}