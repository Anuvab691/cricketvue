'use client';

import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export function GamesGrid() {
  // Use a subset or repeat of placeholder images for the grid effect
  const games = [
    { name: 'SUPER OVER', id: 'cricket-ball' },
    { name: 'IPL 2025', id: 'match-banner-1' },
    { name: 'CRICKET MATKA', id: 'cricket-ball' },
    { name: 'WORLD CUP 2027', id: 'match-banner-1' },
    { name: 'STADIUM LIVE', id: 'cricket-ball' },
    { name: 'PREMIUM CRICKET', id: 'match-banner-1' },
    { name: 'VIP BETTING', id: 'cricket-ball' },
    { name: 'INSTANT WIN', id: 'match-banner-1' },
    { name: 'BALL BY BALL', id: 'cricket-ball' },
    { name: 'BATTING MASTER', id: 'match-banner-1' },
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
