'use client';

import Link from 'next/link';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { PlayCircle, Monitor, Smartphone, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

export function MatchRow({ match }: { match: any }) {
  const isLive = match.status === 'live';
  const matchDate = match.startTime ? parseISO(match.startTime) : new Date();
  
  // Extract professional odds from the record
  const homeBack = match.odds?.home?.back || 1.00;
  const homeLay = match.odds?.home?.lay || 0.00;
  const awayBack = match.odds?.away?.back || 1.00;
  const awayLay = match.odds?.away?.lay || 0.00;

  const [lastUpdateText, setLastUpdateText] = useState('');

  useEffect(() => {
    if (!match.lastUpdated) return;
    const updateTime = () => {
      setLastUpdateText(formatDistanceToNow(parseISO(match.lastUpdated), { addSuffix: true }));
    };
    updateTime();
    const interval = setInterval(updateTime, 5000);
    return () => clearInterval(interval);
  }, [match.lastUpdated]);

  const matchId = match.id ? encodeURIComponent(match.id) : '';

  return (
    <div className="match-row group h-auto min-h-[64px] py-3">
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Link href={`/match/${matchId}`} className="font-black uppercase italic tracking-tighter text-slate-800 hover:text-primary transition-all text-sm">
            {match.teams?.[0] || 'TBA'} v {match.teams?.[1] || 'TBA'}
          </Link>
          <span className="text-[10px] text-slate-400 font-bold">/ {format(matchDate, 'dd/MM HH:mm')}</span>
          {isLive && (
            <div className="flex items-center gap-1 bg-green-500/10 px-1.5 py-0.5 rounded">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-black text-green-600 uppercase">Live</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <div className="flex gap-1.5 items-center">
             <Monitor size={12} className="opacity-30" />
             <Smartphone size={12} className="opacity-30" />
             <PlayCircle size={12} className="text-primary" />
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sportbex Pulse</span>
          </div>
          {match.currentScore && (
            <span className="text-[10px] font-mono text-primary font-black bg-primary/5 px-2 py-0.5 rounded-sm">
              {match.currentScore}
            </span>
          )}
          {match.lastUpdated && (
            <div className="flex items-center gap-1 text-[9px] font-bold text-slate-300 uppercase tracking-tighter">
              <Clock size={10} /> {lastUpdateText}
            </div>
          )}
        </div>
      </div>

      <div className="w-[180px] flex justify-around items-center">
        {/* Home Team Prices */}
        <div className="flex gap-0.5 group/odds">
          <Link href={`/match/${matchId}`} className="odds-box odds-blue w-[38px] h-[34px]">
            <span className="text-xs font-black">{homeBack > 1.00 ? homeBack.toFixed(2) : '-'}</span>
          </Link>
          <Link href={`/match/${matchId}`} className="odds-box odds-pink w-[38px] h-[34px]">
            <span className="text-xs font-black">{homeLay > 0.00 ? homeLay.toFixed(2) : '-'}</span>
          </Link>
        </div>
        
        <div className="w-px h-6 bg-slate-100 hidden md:block" />

        {/* Away Team Prices */}
        <div className="flex gap-0.5 group/odds">
          <Link href={`/match/${matchId}`} className="odds-box odds-blue w-[38px] h-[34px]">
            <span className="text-xs font-black">{awayBack > 1.00 ? awayBack.toFixed(2) : '-'}</span>
          </Link>
          <Link href={`/match/${matchId}`} className="odds-box odds-pink w-[38px] h-[34px]">
            <span className="text-xs font-black">{awayLay > 0.00 ? awayLay.toFixed(2) : '-'}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
