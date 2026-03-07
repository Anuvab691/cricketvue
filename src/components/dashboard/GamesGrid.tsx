'use client';

import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export function GamesGrid() {
  const games = [
    { name: 'MATKA MARKET', id: 'match-banner-1' },
    { name: 'TEENPATTI 1DAY', id: 'cricket-ball' },
    { name: 'DOLI DANA LIVE', id: 'casino-1' },
    { name: 'MOGAMBO', id: 'match-banner-1' },
    { name: 'TEEN PATTI 20-20', id: 'cricket-ball' },
    { name: 'LUCKY 6', id: 'casino-1' },
    { name: 'BEACH ROULETTE', id: 'match-banner-1' },
    { name: 'ROULETTE', id: 'cricket-ball' },
    { name: 'GOLDEN ROULETTE', id: 'casino-1' },
    { name: 'POISON TEENPATTI', id: 'match-banner-1' },
  ];

  return (
    <div className="grid grid-cols-5 md:grid-cols-10 gap-0.5">
      {games.map((game, i) => {
        const placeholder = PlaceHolderImages[i % PlaceHolderImages.length];
        
        return (
          <div key={i} className="relative aspect-[4/3] group overflow-hidden cursor-pointer border border-slate-300">
            <Image 
              src={placeholder.imageUrl} 
              alt={game.name}
              fill
              className="object-cover"
              data-ai-hint={placeholder.imageHint}
            />
            <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 text-center">
              <span className="text-[7px] font-black text-white uppercase leading-none truncate block">
                {game.name}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
