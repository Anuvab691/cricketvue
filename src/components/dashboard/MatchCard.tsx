'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, Clock, MapPin } from 'lucide-react';
import Link from 'next/link';

export function MatchCard({ match }: { match: any }) {
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  
  return (
    <Card className="glass-card overflow-hidden group hover:border-primary/50 transition-all duration-300 relative">
      <CardContent className="p-0">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            {isLive ? (
              <Badge variant="destructive" className="animate-pulse px-3 py-1 text-xs font-bold uppercase tracking-wider">
                Live
              </Badge>
            ) : isFinished ? (
              <Badge variant="secondary" className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-muted">
                Final
              </Badge>
            ) : (
              <Badge variant="outline" className="px-3 py-1 text-xs font-bold uppercase tracking-wider border-primary/30">
                <Clock className="w-3 h-3 mr-1 inline" />
                {match.startTime ? new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBD'}
              </Badge>
            )}
            <div className="flex gap-1 items-center">
              <MapPin className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[100px]">{match.venue || 'Global Venue'}</span>
            </div>
          </div>

          <div className="flex justify-between items-center mb-6">
            <div className="text-center flex-1">
              <p className="text-lg font-bold mb-1 leading-tight">{match.teamA}</p>
            </div>
            <div className="px-4 text-primary/40 font-black italic text-xs">VS</div>
            <div className="text-center flex-1">
              <p className="text-lg font-bold mb-1 leading-tight">{match.teamB}</p>
            </div>
          </div>

          {match.currentScore && (
            <div className="mb-6 p-3 bg-secondary/30 rounded-xl text-center">
              <p className="text-xs font-mono text-accent font-bold leading-relaxed">
                {match.currentScore}
              </p>
            </div>
          )}

          <Link href={`/match/${match.id}`}>
            <Button className="w-full bg-primary hover:bg-primary/90 rounded-xl py-5 font-bold text-sm group-hover:scale-[1.01] transition-transform">
              {isFinished ? 'View Result Details' : 'View Markets'}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
