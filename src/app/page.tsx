'use client';

import { useUser } from '@/firebase';
import { 
  Trophy, Zap, LogIn, Database
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function LandingPage() {
  const { user } = useUser();

  // Match Feed: FORCED EMPTY BY USER REQUEST
  const featuredMatches: any[] = [];

  const heroPlaceholder = PlaceHolderImages.find(p => p.id === 'match-banner-1') || {
    imageUrl: 'https://picsum.photos/seed/cricket1/1200/600',
    imageHint: 'cricket stadium'
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-900 selection:bg-primary/20">
      <header className="exchange-header h-14 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link href="/">
            <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter">CRICKETVUE</h1>
          </Link>
        </div>
        
        <div className="flex items-center gap-3">
          {user ? (
            <Link href="/dashboard">
              <Button className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-xs font-black uppercase rounded-sm px-6">
                 Go to Dashboard
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" className="text-white hover:bg-white/10 text-xs font-bold uppercase">
                  <LogIn className="w-4 h-4 mr-2" /> Login
                </Button>
              </Link>
              <Link href="/login">
                <Button className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-xs font-black uppercase rounded-sm px-6">
                   Join Now
                </Button>
              </Link>
            </>
          )}
        </div>
      </header>

      <section className="relative h-[350px] md:h-[450px] w-full overflow-hidden">
        <Image 
          src={heroPlaceholder.imageUrl}
          alt="Cricket Hero"
          fill
          className="object-cover"
          priority
          data-ai-hint={heroPlaceholder.imageHint}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent flex items-center">
          <div className="container mx-auto px-6 space-y-4">
            <div className="inline-flex items-center gap-2 bg-primary px-3 py-1 rounded text-[10px] font-black uppercase text-white tracking-widest">
              <Zap className="w-3 h-3 fill-white" /> Market Terminal
            </div>
            <h2 className="text-4xl md:text-7xl font-black text-white italic tracking-tighter leading-[0.9]">
              ULTIMATE CRICKET <br /> EXCHANGE
            </h2>
            <p className="text-white/80 text-sm md:text-lg max-w-lg font-medium">
              Real-time insights and professional data synchronization.
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <h3 className="text-2xl font-black uppercase italic flex items-center gap-2 tracking-tight">
              <Trophy className="text-primary" size={24} /> Match Terminal
            </h3>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden p-20 text-center flex flex-col items-center gap-4">
          <Database size={48} className="text-slate-200" />
          <div className="space-y-2">
            <p className="text-lg font-black uppercase text-slate-400">Terminal Suspended</p>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
              Live feed is currently disabled by administrator.
            </p>
          </div>
        </div>
      </section>

      <footer className="bg-white border-t border-slate-200 py-10">
        <div className="container mx-auto px-6 text-center space-y-4">
          <h2 className="text-2xl font-black italic tracking-tighter text-slate-300">CRICKETVUE</h2>
          <p className="text-[9px] text-slate-300 font-bold uppercase tracking-[0.3em] pt-4">
            © 2025 CRICKETVUE EXCHANGE | SECURE DATA TERMINAL
          </p>
        </div>
      </footer>
    </div>
  );
}
