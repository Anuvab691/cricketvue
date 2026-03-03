
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, Calendar, CheckCircle2, Trophy, ArrowUpRight, Zap } from 'lucide-react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';

export function MatchCard({ match }: { match: any }) {
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  
  const matchDate = match.startTime ? parseISO(match.startTime) : null;
  const formattedDate = matchDate ? format(matchDate, 'MMM dd, yyyy') : 'TBD';
  const formattedTime = matchDate ? format(matchDate, 'HH:mm') : 'TBD';

  // Display logic: Prioritize numeric currentScore over statusText
  const hasLiveScore = match.currentScore && match.currentScore !== 'TBD';
  const displayScore = hasLiveScore ? match.currentScore : match.statusText;

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
          {isLive && (
            <span className="text-[9px] font-black text-primary animate-pulse flex items-center gap-1 uppercase tracking-tighter">
              <Zap className="w-3 h-3 fill-primary" /> LIVE FEED
            </span>
          )}
        </div>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            {isLive ? (
              <Badge variant="destructive" className="animate-pulse px-3 py-1 text-xs font-bold uppercase tracking-wider">
                In-Play
              </Badge>
            ) : isFinished ? (
              <Badge variant="secondary" className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-green-500/20 text-green-500 border-green-500/30">
                <CheckCircle2 className="w-3 h-3 mr-1 inline" />
                Final Result
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
              <p className="text-lg font-black uppercase italic tracking-tighter leading-tight">{match.teamA}</p>
            </div>
            <div className="px-4 text-primary/40 font-black italic text-xs">VS</div>
            <div className="text-center flex-1">
              <p className="text-lg font-black uppercase italic tracking-tighter leading-tight">{match.teamB}</p>
            </div>
          </div>

          {displayScore && (
            <div className="mb-6 p-3 bg-secondary/10 rounded-sm text-center border border-white/5">
              <p className="text-sm font-mono text-accent font-black leading-relaxed">
                {displayScore}
              </p>
              {hasLiveScore && match.statusText && match.statusText !== displayScore && (
                <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mt-1.5 opacity-60">
                  {match.statusText}
                </p>
              )}
            </div>
          )}

          <Link href={`/match/${match.id}`}>
            <Button className="w-full bg-primary hover:bg-primary/90 rounded-sm py-5 font-black text-xs uppercase italic tracking-widest group-hover:scale-[1.01] transition-transform gap-2">
              {isFinished ? 'View Statistics' : 'Open Markets'}
              <ArrowUpRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
