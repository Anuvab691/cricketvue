'use client';

import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export function GamesGrid() {
  // Cricket-only focused games for the dashboard
  const games = [
    { name: 'SUPER OVER LIVE', id: 'cricket-ball' },
    { name: 'CHAMPIONS TROPHY', id: 'match-banner-1' },
    { name: 'BOUNDARY BLITZ', id: 'cricket-ball' },
    { name: 'WICKET WATCH', id: 'match-banner-1' },
    { name: 'TEST CLASSIC', id: 'cricket-ball' },
    { name: 'T20 SMASH', id: 'match-banner-1' },
    { name: 'CREASE MASTER', id: 'cricket-ball' },
    { name: 'STADIUM VIP', id: 'match-banner-1' },
    { name: 'BALL-BY-BALL', id: 'cricket-ball' },
    { name: 'BATTING LEGENDS', id: 'match-banner-1' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1">
      {games.map((game, i) => {
        const placeholder = PlaceHolderImages.find(p => p.id === game.id) || PlaceHolderImages[0];
        return (
          <div key={i} className="relative aspect-video group overflow-hidden cursor-pointer border border-slate-200">
            <Image 
              src={placeholder.imageUrl} 
              alt={game.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              data-ai-hint={placeholder.imageHint}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2">
              <span className="text-[9px] font-black text-white uppercase tracking-tighter drop-shadow-md">
                {game.name}
              </span>
              <div className="w-full h-1 bg-primary/40 mt-1 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
