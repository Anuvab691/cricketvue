'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, Calendar, CheckCircle2, Trophy } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export function MatchCard({ match }: { match: any }) {
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  
  const matchDate = match.startTime ? new Date(match.startTime) : null;
  const formattedDate = matchDate ? format(matchDate, 'MMM dd, yyyy') : 'TBD';
  const formattedTime = matchDate ? format(matchDate, 'HH:mm') : 'TBD';

  return (
    <Card className="glass-card overflow-hidden group hover:border-primary/50 transition-all duration-300 relative">
      <CardContent className="p-0">
        <div className="bg-primary/5 px-6 py-2 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <Trophy className="w-3 h-3 text-accent shrink-0" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              {match.series || 'International Series'}
            </span>
          </div>
        </div>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            {isLive ? (
              <Badge variant="destructive" className="animate-pulse px-3 py-1 text-xs font-bold uppercase tracking-wider">
                Live
              </Badge>
            ) : isFinished ? (
              <Badge variant="secondary" className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-green-500/20 text-green-500 border-green-500/30">
                <CheckCircle2 className="w-3 h-3 mr-1 inline" />
                Final
              </Badge>
            ) : (
              <div className="flex flex-col gap-1">
                <Badge variant="outline" className="px-3 py-1 text-xs font-bold uppercase tracking-wider border-primary/30 w-fit">
                  <Calendar className="w-3 h-3 mr-1 inline" />
                  {formattedDate}
                </Badge>
                <Badge variant="outline" className="px-2 py-0.5 text-[10px] font-medium border-primary/10 w-fit opacity-70">
                  <Clock className="w-2.5 h-2.5 mr-1 inline" />
                  {formattedTime}
                </Badge>
              </div>
            )}
            <div className="flex gap-1 items-center self-start">
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

          {(match.currentScore || (isFinished && match.statusText)) && (
            <div className="mb-6 p-3 bg-secondary/30 rounded-xl text-center border border-white/5">
              <p className="text-[11px] font-mono text-accent font-bold leading-relaxed mb-1">
                {match.currentScore && match.currentScore !== 'TBD' ? match.currentScore : match.statusText}
              </p>
              {isFinished && match.statusText && match.currentScore !== 'TBD' && (
                <p className="text-[10px] text-muted-foreground italic mt-1 border-t border-white/5 pt-1">
                  {match.statusText}
                </p>
              )}
            </div>
          )}

          <Link href={`/match/${match.id}`}>
            <Button className="w-full bg-primary hover:bg-primary/90 rounded-xl py-5 font-bold text-sm group-hover:scale-[1.01] transition-transform">
              {isFinished ? 'View Final Result' : 'View Markets'}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
