'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { PlayCircle, Clock, Info, Smartphone, Monitor, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MatchRow({ match }: { match: any }) {
  const isLive = match.status === 'live';
  const matchDate = match.startTime ? parseISO(match.startTime) : new Date();
  
  // Market simulation (for UI only)
  const backOdds = 1.90;
  const layOdds = 2.10;

  return (
    <div className="match-row group">
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <Link href={`/match/${match.id}`} className="font-bold text-slate-800 hover:text-primary transition-colors cursor-pointer">
            {match.teamA} v {match.teamB}
          </Link>
          <span className="text-[10px] text-slate-400">/ {format(matchDate, 'dd/MM/yyyy HH:mm')}</span>
          {isLive && (
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <div className="flex gap-1.5 items-center">
             <Monitor size={12} className="opacity-50" />
             <Smartphone size={12} className="opacity-50" />
             <PlayCircle size={12} className="text-green-500" />
             <span className="text-[10px] font-bold text-slate-500">BM</span>
          </div>
          {match.currentScore && (
            <span className="text-[10px] font-mono text-primary font-bold">
              {match.currentScore}
            </span>
          )}
        </div>
      </div>

      <div className="w-[180px] flex justify-around">
        {/* Back and Lay simulation buttons */}
        <div className="flex gap-0.5">
          <div className="odds-box odds-blue">
            <span>{backOdds.toFixed(2)}</span>
            <span className="text-[8px] opacity-70">0</span>
          </div>
          <div className="odds-box odds-pink">
            <span>{layOdds.toFixed(2)}</span>
            <span className="text-[8px] opacity-70">0</span>
          </div>
        </div>
        
        <div className="flex gap-0.5 opacity-30">
          <div className="odds-box bg-slate-100">
            <span>-</span>
          </div>
          <div className="odds-box bg-slate-100">
            <span>-</span>
          </div>
        </div>

        <div className="flex gap-0.5">
          <div className="odds-box odds-blue">
            <span>{(backOdds + 0.1).toFixed(2)}</span>
            <span className="text-[8px] opacity-70">0</span>
          </div>
          <div className="odds-box odds-pink">
            <span>{(layOdds + 0.1).toFixed(2)}</span>
            <span className="text-[8px] opacity-70">0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
