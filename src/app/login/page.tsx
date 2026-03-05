'use client';

import { useAuth, useUser, useFirestore } from '@/firebase';
import { accessSystem } from '@/firebase/auth/auth-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, LogIn, UserCircle2 } from 'lucide-react';
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

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
        description: error.message || "Invalid credentials.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDemoLogin = async () => {
    setEmail('admin@cricketvue.com');
    setPassword('demo1234');
    // We delay slightly so the user sees the fields populated
    setTimeout(() => handleSubmit(), 100);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0077b6]">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0077b6] p-4 font-body">
      <div className="w-full max-w-[360px] space-y-6">
        <div className="text-center text-white space-y-2">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase">CricketVue</h1>
          <p className="text-[10px] font-bold tracking-[0.2em] opacity-80 uppercase">Premium Exchange Terminal</p>
        </div>

        <Card className="border-none rounded-sm shadow-2xl overflow-hidden bg-white">
          <CardContent className="p-6 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[10px] font-black uppercase text-slate-400">Username / Email</Label>
                <div className="relative">
                  <Input 
                    id="email"
                    type="email" 
                    placeholder="Enter Username" 
                    className="h-11 bg-slate-50 border-slate-200 rounded-sm text-sm font-bold"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="password" title="Demo Pass: demo1234" className="text-[10px] font-black uppercase text-slate-400">Password</Label>
                <Input 
                  id="password"
                  type="password" 
                  placeholder="Enter Password" 
                  className="h-11 bg-slate-50 border-slate-200 rounded-sm text-sm font-bold"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button 
                type="submit"
                disabled={isProcessing}
                className="w-full h-11 bg-[#0077b6] hover:bg-[#005f91] text-white font-black text-sm uppercase rounded-sm flex items-center justify-between px-6 transition-all active:scale-95"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  <>
                    <span>Login</span>
                    <LogIn className="w-5 h-5" />
                  </>
                )}
              </Button>
            </form>

            <Button 
              onClick={handleDemoLogin}
              disabled={isProcessing}
              className="w-full h-11 bg-[#0077b6] hover:bg-[#005f91] text-white font-black text-sm uppercase rounded-sm flex items-center justify-between px-6 transition-all active:scale-95"
            >
              <span>Login with demo ID</span>
              <UserCircle2 className="w-5 h-5" />
            </Button>

            <div className="pt-4 space-y-4 text-center">
              <p className="text-[9px] text-slate-500 leading-tight max-w-[280px] mx-auto">
                This site is protected by reCAPTCHA and the Google 
                <Link href="#" className="text-[#0077b6] mx-1">Privacy Policy</Link> 
                and 
                <Link href="#" className="text-[#0077b6] mx-1">Terms of Service</Link> 
                apply.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-white/50 text-[9px] font-bold uppercase tracking-widest pt-4">
          Authorized Access Only © 2025
        </div>
      </div>
    </div>
  );
}
