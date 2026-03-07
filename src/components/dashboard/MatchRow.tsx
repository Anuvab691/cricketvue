'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Monitor, Info, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MatchRow({ match }: { match: any }) {
  const isLive = match.status === 'live';
  const matchDate = match.startTime ? parseISO(match.startTime) : new Date();

  // Odds Extraction for 1-X-2
  const getOdds = (side: 'home' | 'away' | 'draw') => {
    const data = match.odds?.[side];
    return {
      back: data?.back?.[0]?.price || '-',
      lay: data?.lay?.[0]?.price || '-'
    };
  };

  const home = getOdds('home');
  const away = getOdds('away');
  const draw = getOdds('draw');

  return (
    <div className="match-row">
      <div className="flex-1 flex items-center px-4 gap-3">
        <div className="flex flex-col flex-1">
          <Link href={`/match/${match.id}`} className="hover:underline font-bold text-slate-700 truncate">
            {match.teamA} v {match.teamB} / {format(matchDate, 'dd/MM/yyyy HH:mm:ss')}
          </Link>
        </div>
        
        <div className="flex items-center gap-2">
           {isLive && <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />}
           <Monitor size={14} className="text-slate-400" />
           <span className="text-[10px] font-bold text-slate-400">f</span>
           <span className="text-[10px] font-black text-slate-800">BM</span>
        </div>
      </div>

      <div className="w-[288px] flex h-full">
        {/* 1 (Home) */}
        <div className="flex border-l border-slate-100">
           <div className="odds-grid-box odds-back">{home.back}</div>
           <div className="odds-grid-box odds-lay">{home.lay}</div>
        </div>
        {/* X (Draw) */}
        <div className="flex border-l border-slate-100">
           <div className="odds-grid-box odds-back">{draw.back}</div>
           <div className="odds-grid-box odds-lay">{draw.lay}</div>
        </div>
        {/* 2 (Away) */}
        <div className="flex border-l border-slate-100">
           <div className="odds-grid-box odds-back">{away.back}</div>
           <div className="odds-grid-box odds-lay">{away.lay}</div>
        </div>
      </div>
    </div>
  );
}
