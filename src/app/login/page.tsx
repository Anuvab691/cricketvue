'use client';

import { useAuth, useUser } from '@/firebase';
import { signInWithGoogle } from '@/firebase/auth/auth-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Rocket, Chrome, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const { user, loading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleLogin = async () => {
    if (!auth) return;
    setIsSigningIn(true);
    try {
      await signInWithGoogle(auth);
    } catch (error) {
      // Error is logged in the service
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex p-4 bg-primary rounded-2xl shadow-2xl vibrant-glow mb-4">
            <Rocket className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter font-headline">CricketVue</h1>
          <p className="text-muted-foreground">Premium Predictions & Live Insights</p>
        </div>

        <Card className="glass-card border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-bold text-center">Welcome Back</CardTitle>
            <CardDescription className="text-center">
              Sign in to manage your virtual tokens and place bets on live matches.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Button 
              onClick={handleLogin} 
              disabled={isSigningIn}
              className="w-full h-12 bg-white text-black hover:bg-white/90 font-bold rounded-xl gap-3 transition-all active:scale-95"
            >
              {isSigningIn ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Chrome className="w-5 h-5" />
              )}
              Continue with Google
            </Button>
            
            <p className="mt-8 text-center text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
              Secure Virtual Betting Platform
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <p className="text-accent font-black text-lg">Real</p>
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Data</p>
          </div>
          <div className="space-y-1">
            <p className="text-primary font-black text-lg">AI</p>
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Insights</p>
          </div>
          <div className="space-y-1">
            <p className="text-white font-black text-lg">Safe</p>
            <p className="text-[10px] text-muted-foreground uppercase font-bold">Mock Bets</p>
          </div>
        </div>
      </div>
    </div>
  );
}
