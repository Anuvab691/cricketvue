'use client';

import Link from 'next/link';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { PlayCircle, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

export function MatchRow({ match }: { match: any }) {
  const isLive = match.status === 'live';
  const matchDate = match.startTime ? parseISO(match.startTime) : new Date();
  
  const marketStatus = match.odds?.status || 'OPEN';
  const isSuspended = marketStatus !== 'OPEN';

  // Professional Odds Mapping
  const homeBack = match.odds?.home?.back;
  const homeLay = match.odds?.home?.lay;
  const homeLast = match.odds?.home?.lastPrice;
  
  const awayBack = match.odds?.away?.back;
  const awayLay = match.odds?.away?.lay;
  const awayLast = match.odds?.away?.lastPrice;

  const [lastUpdateText, setLastUpdateText] = useState('');

  useEffect(() => {
    if (!match.lastUpdated) return;
    const updateTime = () => {
      try {
        setLastUpdateText(formatDistanceToNow(parseISO(match.lastUpdated), { addSuffix: true }));
      } catch (e) {
        setLastUpdateText('Just now');
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 5000);
    return () => clearInterval(interval);
  }, [match.lastUpdated]);

  const matchId = match.id || '';

  const formatPrice = (p: any, lastPrice?: number) => {
    // ONLY show SUSP if market level status is not OPEN
    if (isSuspended) return 'SUSP';
    
    // If market is OPEN but specific liquidity box is empty
    if (!p || p === 1 || p === 0) {
      return lastPrice ? lastPrice.toFixed(2) : '-';
    }
    return p.toFixed(2);
  };

  return (
    <div className="match-row group h-auto min-h-[90px] py-4">
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <Link href={`/match/${matchId}`} className="font-black uppercase italic tracking-tighter text-slate-800 hover:text-primary transition-all text-sm md:text-base">
            {match.teamA || 'TBA'} v {match.teamB || 'TBA'}
          </Link>
          <span className="text-[10px] text-slate-400 font-bold">/ {format(matchDate, 'dd/MM HH:mm')}</span>
          {isLive && (
            <div className="flex items-center gap-1 bg-green-500/10 px-1.5 py-0.5 rounded">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-black text-green-600 uppercase tracking-tighter">Live</span>
            </div>
          )}
        </div>
        
        {(match.currentScore || match.score) && (
          <div className="flex items-center gap-2">
            <span className="text-xs md:text-sm font-mono text-primary font-black bg-primary/5 px-2 py-0.5 rounded-sm border border-primary/10">
              {match.currentScore || match.score}
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">
              {match.statusText || match.rawStatusText || 'Updating...'}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 text-slate-400 mt-1">
          <div className="flex gap-1.5 items-center">
             <PlayCircle size={12} className="text-primary" />
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Exchange Pulse</span>
          </div>
          {match.lastUpdated && (
            <div className="flex items-center gap-1 text-[9px] font-bold text-slate-300 uppercase tracking-tighter">
              <Clock size={10} /> Sync {lastUpdateText}
            </div>
          )}
        </div>
      </div>

      <div className="w-[180px] flex justify-around items-center shrink-0">
        <div className="flex gap-0.5">
          <div className="odds-grid-box odds-back w-[42px] h-[40px] border-none rounded-sm">
            <span className="text-[10px] font-black">{formatPrice(homeBack, homeLast)}</span>
          </div>
          <div className="odds-grid-box odds-lay w-[42px] h-[40px] border-none rounded-sm">
            <span className="text-[10px] font-black">{formatPrice(homeLay)}</span>
          </div>
        </div>
        
        <div className="w-px h-8 bg-slate-100 hidden md:block" />

        <div className="flex gap-0.5">
          <div className="odds-grid-box odds-back w-[42px] h-[40px] border-none rounded-sm">
            <span className="text-[10px] font-black">{formatPrice(awayBack, awayLast)}</span>
          </div>
          <div className="odds-grid-box odds-lay w-[42px] h-[40px] border-none rounded-sm">
            <span className="text-[10px] font-black">{formatPrice(awayLay)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
