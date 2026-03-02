
'use client';

import { useFirestore, useCollection, useUser } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { 
  Trophy, Zap, ShieldCheck, ArrowRight, 
  LogIn, Star
} from 'lucide-react';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { MatchRow } from '@/components/dashboard/MatchRow';
import { parseISO, isToday, isAfter, startOfToday } from 'date-fns';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const firestore = useFirestore();
  const { user, loading: authLoading } = useUser();
  const router = useRouter();

  // If user is already logged in, we can optionally redirect them to dashboard
  // but usually a home page exists for public. Let's keep it for guest viewing.

  const matchesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'matches'), 
      orderBy('startTime', 'asc'),
      limit(5)
    );
  }, [firestore]);

  const { data: matches, loading: matchesLoading } = useCollection(matchesQuery);

  const todayStart = startOfToday();
  const featuredMatches = (matches || []).filter(m => {
    if (!m.startTime) return false;
    const matchTime = parseISO(m.startTime);
    return isToday(matchTime) || isAfter(matchTime, todayStart);
  });

  const heroPlaceholder = PlaceHolderImages.find(p => p.id === 'match-banner-1') || {
    imageUrl: 'https://picsum.photos/seed/cricket1/1200/600',
    imageHint: 'cricket stadium'
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-900 selection:bg-primary/20">
      {/* Top Blue Header */}
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

      {/* Hero Banner */}
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
              <Zap className="w-3 h-3 fill-white" /> Real-Time Markets
            </div>
            <h2 className="text-4xl md:text-7xl font-black text-white italic tracking-tighter leading-[0.9]">
              ASIA'S MOST <br /> TRUSTED EXCHANGE
            </h2>
            <p className="text-white/80 text-sm md:text-lg max-w-lg font-medium">
              Experience lightning-fast rates, AI-powered insights, and the ultimate cricket betting terminal.
            </p>
            <div className="pt-4 flex gap-4">
              <Link href="/login">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-white font-bold rounded-sm gap-2 h-14 px-8">
                  Get Started <ArrowRight size={20} />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Matches Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <h3 className="text-2xl font-black uppercase italic flex items-center gap-2 tracking-tight">
              <Trophy className="text-primary" size={24} /> Live & Upcoming Matches
            </h3>
            <p className="text-xs text-slate-500 font-bold uppercase">Showing top events from global series</p>
          </div>
          <Link href="/dashboard" className="text-primary text-sm font-bold hover:underline bg-primary/5 px-4 py-2 rounded-full transition-colors">
            Full Market Schedule
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
          {/* Match Table Header */}
          <div className="bg-slate-100 border-b border-slate-200 flex items-center px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">
            <div className="flex-1">Match Event</div>
            <div className="w-[180px] flex justify-around text-center">
              <div className="w-12">1 (Back)</div>
              <div className="w-12">X (Draw)</div>
              <div className="w-12">2 (Lay)</div>
            </div>
          </div>
          
          <div className="divide-y divide-slate-100">
            {matchesLoading ? (
              <div className="p-20 text-center flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Syncing Live Data</span>
              </div>
            ) : featuredMatches.length > 0 ? (
              featuredMatches.map(match => (
                <MatchRow key={match.id} match={match} />
              ))
            ) : (
              <div className="p-16 text-center text-slate-400 text-sm font-medium">
                No active matches found. Check back soon for Champions Trophy action!
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="bg-slate-900 text-white py-20">
        <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="flex flex-col items-center text-center space-y-4 group">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
              <ShieldCheck className="text-primary" size={32} />
            </div>
            <h4 className="font-black text-lg uppercase italic tracking-tighter">Secure Hierarchy</h4>
            <p className="text-white/50 text-xs leading-relaxed max-w-[250px]">
              Multi-tier account management for Admin, Super, and Master roles with instant token settlements.
            </p>
          </div>
          <div className="flex flex-col items-center text-center space-y-4 group">
            <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center group-hover:bg-accent/30 transition-colors">
              <Star className="text-accent" size={32} />
            </div>
            <h4 className="font-black text-lg uppercase italic tracking-tighter">AI Predictor</h4>
            <p className="text-white/50 text-xs leading-relaxed max-w-[250px]">
              Get professional-grade match insights and playful facts powered by our custom Genkit AI model.
            </p>
          </div>
          <div className="flex flex-col items-center text-center space-y-4 group">
            <div className="w-16 h-16 rounded-2xl bg-yellow-400/20 flex items-center justify-center group-hover:bg-yellow-400/30 transition-colors">
              <Zap className="text-yellow-400" size={32} />
            </div>
            <h4 className="font-black text-lg uppercase italic tracking-tighter">Actual Web Sync</h4>
            <p className="text-white/50 text-xs leading-relaxed max-w-[250px]">
              Powered by official cricket data APIs. Your dashboard stays synced with the real world every 15 seconds.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-10">
        <div className="container mx-auto px-6 text-center space-y-4">
          <h2 className="text-2xl font-black italic tracking-tighter text-slate-300">CRICKETVUE</h2>
          <div className="flex justify-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <Link href="/login" className="hover:text-primary">Terms</Link>
            <Link href="/login" className="hover:text-primary">Privacy</Link>
            <Link href="/login" className="hover:text-primary">Rules</Link>
          </div>
          <p className="text-[9px] text-slate-300 font-bold uppercase tracking-[0.3em] pt-4">
            © 2025 CRICKETVUE EXCHANGE | AUTHORIZED ACCESS ONLY
          </p>
        </div>
      </footer>
    </div>
  );
}
