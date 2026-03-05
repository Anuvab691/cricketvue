'use client';

import Link from 'next/link';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { PlayCircle, Monitor, Smartphone, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

export function MatchRow({ match }: { match: any }) {
  const isLive = match.status === 'live';
  const matchDate = match.startTime ? parseISO(match.startTime) : new Date();
  
  // Use odds from the match object populated by sync-matches
  const homeBack = match.odds?.home?.back || 1.90;
  const homeLay = match.odds?.home?.lay || 1.92;
  const awayBack = match.odds?.away?.back || 1.90;
  const awayLay = match.odds?.away?.lay || 1.92;

  // Track relative time since last update
  const [lastUpdateText, setLastUpdateText] = useState('');

  useEffect(() => {
    if (!match.lastUpdated) return;
    const interval = setInterval(() => {
      setLastUpdateText(formatDistanceToNow(parseISO(match.lastUpdated), { addSuffix: true }));
    }, 5000);
    setLastUpdateText(formatDistanceToNow(parseISO(match.lastUpdated), { addSuffix: true }));
    return () => clearInterval(interval);
  }, [match.lastUpdated]);

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
          {match.lastUpdated && (
            <div className="flex items-center gap-1 text-[9px] font-bold text-slate-300 uppercase tracking-tighter">
              <Clock size={10} /> {lastUpdateText || 'Just now'}
            </div>
          )}
        </div>
      </div>

      <div className="w-[180px] flex justify-around">
        {/* Home Team Odds */}
        <Link href={`/match/${match.id}`} className="flex gap-0.5">
          <div className="odds-box odds-blue">
            <span>{homeBack.toFixed(2)}</span>
            <span className="text-[8px] opacity-70">0</span>
          </div>
          <div className="odds-box odds-pink">
            <span>{homeLay.toFixed(2)}</span>
            <span className="text-[8px] opacity-70">0</span>
          </div>
        </Link>
        
        <div className="flex gap-0.5 opacity-30">
          <div className="odds-box bg-slate-100">
            <span>-</span>
          </div>
          <div className="odds-box bg-slate-100">
            <span>-</span>
          </div>
        </div>

        {/* Away Team Odds */}
        <Link href={`/match/${match.id}`} className="flex gap-0.5">
          <div className="odds-box odds-blue">
            <span>{awayBack.toFixed(2)}</span>
            <span className="text-[8px] opacity-70">0</span>
          </div>
          <div className="odds-box odds-pink">
            <span>{awayLay.toFixed(2)}</span>
            <span className="text-[8px] opacity-70">0</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
