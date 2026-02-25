'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, History, Wallet, Menu, X, Rocket, LogOut, User as UserIcon, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useFirestore, useDoc, useAuth, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';
import { logout } from '@/firebase/auth/auth-service';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function Sidebar({ userId }: { userId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const firestore = useFirestore();
  const auth = useAuth();
  const { user } = useUser();

  const userRef = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return doc(firestore, 'users', userId);
  }, [firestore, userId]);

  const { data: userData } = useDoc(userRef);

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'My Bets', href: '/my-bets', icon: History },
  ];

  const tokenBalance = userData?.tokenBalance || 1000; // Default balance for guests

  const handleLogout = async () => {
    if (auth && user) {
      await logout(auth);
    }
    router.push('/login');
  };

  return (
    <>
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button variant="outline" size="icon" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X /> : <Menu />}
        </Button>
      </div>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transition-transform lg:translate-x-0",
        !isOpen && "-translate-x-full"
      )}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center gap-2 mb-10">
            <div className="p-2 bg-primary rounded-xl shadow-lg vibrant-glow">
              <Rocket className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white font-headline">CricketVue</span>
          </div>

          <div className="mb-8 flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
            <Avatar className="h-10 w-10 border border-primary/20">
              <AvatarImage src={user?.photoURL || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary">
                <UserIcon className="w-5 h-5" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate text-white">{user?.displayName || (user ? 'Authenticated User' : 'Guest Fan')}</p>
              <p className="text-[10px] text-muted-foreground truncate uppercase tracking-tighter">
                {user ? 'Verified Member' : 'Guest Mode'}
              </p>
            </div>
          </div>

          <div className="mb-8 p-4 bg-secondary/50 rounded-2xl border border-border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-1">
              <Wallet className="w-3 h-3" />
              <span>Virtual Balance</span>
            </div>
            <div className="text-2xl font-bold text-accent">
              {tokenBalance.toLocaleString()} <span className="text-sm font-medium">Tokens</span>
            </div>
          </div>

          <nav className="flex-1 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  pathname === item.href 
                    ? "bg-primary text-primary-foreground shadow-lg vibrant-glow" 
                    : "text-muted-foreground hover:bg-muted hover:text-white"
                )}
              >
                <item.icon className={cn("w-5 h-5", pathname === item.href ? "text-white" : "group-hover:scale-110 transition-transform")} />
                <span className="font-medium">{item.name}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-auto pt-6 space-y-4">
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-3 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl"
              onClick={handleLogout}
            >
              {user ? <LogOut className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
              <span className="font-medium">{user ? 'Sign Out' : 'Sign In'}</span>
            </Button>

            <div className="p-4 bg-primary/10 rounded-xl border border-primary/20">
              <p className="text-xs text-primary font-bold uppercase tracking-widest mb-1">Status</p>
              <p className="text-sm text-white flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Live Network
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
