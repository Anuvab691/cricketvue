'use client';

import { useAuth, useUser, useFirestore } from '@/firebase';
import { accessSystem } from '@/firebase/auth/auth-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Rocket, Loader2, KeyRound, Mail, ArrowLeft, ShieldAlert, LockKeyhole } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function LoginPage() {
  const { user, loading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
    
    setIsProcessing(true);
    try {
      await accessSystem(auth, firestore, email, password);
      toast({ 
        title: "Access Granted", 
        description: "Welcome to the CricketVue Network." 
      });
    } catch (error: any) {
      toast({ 
        title: "Access Denied", 
        description: error.message || "Invalid credentials or unauthorized email.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
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
        <div className="flex justify-start">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <ArrowLeft className="w-4 h-4" /> Guest View
            </Button>
          </Link>
        </div>

        <div className="text-center space-y-2">
          <div className="inline-flex p-4 bg-primary rounded-2xl shadow-2xl vibrant-glow mb-4">
            <Rocket className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter font-headline">CricketVue</h1>
          <p className="text-muted-foreground">Secure Network Management</p>
        </div>

        <Card className="glass-card border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          <CardHeader className="pb-2 text-center">
            <div className="flex justify-center mb-2">
              <LockKeyhole className="w-6 h-6 text-accent opacity-50" />
            </div>
            <CardTitle className="text-xl font-bold">Network Access</CardTitle>
            <CardDescription>
              Enter your credentials to access your terminal.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-primary font-bold text-xs">
                <ShieldAlert className="w-4 h-4" />
                AUTHORIZED PERSONNEL ONLY
              </div>
              <p className="text-[11px] text-primary/90 leading-tight">
                This system is closed to the public. If you are a new Super, Master, or Customer, enter your email and set your password to activate your pre-authorized profile.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Work Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="email"
                    type="email" 
                    placeholder="name@cricketvue.com" 
                    className="pl-10 h-12 bg-background/50 border-white/10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Security Password</Label>
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
                disabled={isProcessing}
                className="w-full h-12 bg-primary hover:bg-primary/90 font-bold rounded-xl gap-3 transition-all active:scale-95 mt-4 shadow-lg shadow-primary/20"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Enter Network'
                )}
              </Button>
            </form>
            
            <div className="mt-8 text-center text-[10px] text-muted-foreground uppercase tracking-widest opacity-50">
              © 2025 CricketVue Apex Hierarchy
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
