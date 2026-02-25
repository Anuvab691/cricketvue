'use client';

import { useAuth, useUser } from '@/firebase';
import { loginWithEmail, signUpWithEmail } from '@/firebase/auth/auth-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Rocket, Loader2, KeyRound, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';

export default function LoginPage() {
  const { user, loading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    
    setIsSigningIn(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(auth, email, password);
        toast({ title: "Account Created", description: "Welcome to CricketVue!" });
      } else {
        await loginWithEmail(auth, email, password);
        toast({ title: "Welcome Back", description: "Successfully signed in." });
      }
    } catch (error: any) {
      toast({ 
        title: "Authentication Failed", 
        description: error.message || "Check your credentials and try again.",
        variant: "destructive"
      });
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
            <CardTitle className="text-xl font-bold text-center">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </CardTitle>
            <CardDescription className="text-center">
              {isSignUp 
                ? 'Join thousands of fans and start tracking your virtual bets.' 
                : 'Sign in to manage your virtual tokens and live matches.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="email"
                    type="email" 
                    placeholder="name@example.com" 
                    className="pl-10 h-12 bg-background/50 border-white/10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="password"
                    type="password" 
                    placeholder="••••••••" 
                    className="pl-10 h-12 bg-background/50 border-white/10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit"
                disabled={isSigningIn}
                className="w-full h-12 bg-primary hover:bg-primary/90 font-bold rounded-xl gap-3 transition-all active:scale-95 mt-4"
              >
                {isSigningIn ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  isSignUp ? 'Sign Up' : 'Sign In'
                )}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <button 
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-accent hover:underline font-medium"
              >
                {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
              </button>
            </div>
            
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
