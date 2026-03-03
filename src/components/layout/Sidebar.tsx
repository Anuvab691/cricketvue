
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Menu, X, ShieldAlert, ShieldCheck, Users, 
  ChevronDown, Trophy, Clock, LayoutGrid, Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';

export function Sidebar({ userId }: { userId: string }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const firestore = useFirestore();

  const userRef = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return doc(firestore, 'users', userId);
  }, [firestore, userId]);

  const { data: userData } = useDoc(userRef);

  return (
    <>
      <div className="lg:hidden fixed top-2 left-2 z-50">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={16} /> : <Menu size={16} />}
        </Button>
      </div>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-[240px] bg-white border-r border-slate-200 transition-transform lg:translate-x-0 shadow-sm",
        !isOpen && "-translate-x-full"
      )}>
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
          <div className="mt-0">
            <div className="sidebar-section-header">
              <span>Main Menu</span>
              <ChevronDown size={14} />
            </div>
            <div className="bg-slate-50">
              <Link href="/dashboard" className={cn("sidebar-item", pathname === '/dashboard' && "bg-slate-200 font-bold text-primary")}>
                <LayoutGrid size={12} /> Dashboard
              </Link>
              <Link href="/tournaments" className={cn("sidebar-item", pathname === '/tournaments' && "bg-slate-200 font-bold text-primary")}>
                <Star size={12} className="text-yellow-500" /> Tournaments
              </Link>
              <div className={cn("sidebar-item font-bold text-slate-800", pathname.includes('match') && !pathname.includes('centre') && !pathname.includes('tour') && "text-primary")}>
                <Trophy size={12} className="text-primary" /> Live Cricket
              </div>
            </div>

            <div className="sidebar-section-header mt-1">
              <span>Match Center</span>
              <ChevronDown size={14} />
            </div>
            <div className="bg-slate-50">
              <Link href="/match-centre/international" className="sidebar-item">International</Link>
              <Link href="/match-centre/t20" className="sidebar-item">T20 Leagues</Link>
              <Link href="/match-centre/test" className="sidebar-item">Test Series</Link>
              <Link href="/match-centre/odi" className="sidebar-item">One Day Int'l</Link>
            </div>

            <div className="sidebar-section-header mt-1">
              <span>My Stats</span>
              <ChevronDown size={14} />
            </div>
            <div className="bg-slate-50">
              <Link href="/my-bets" className={cn("sidebar-item", pathname === '/my-bets' && "bg-slate-200 font-bold text-primary")}>
                <Clock size={12} /> My Bets
              </Link>
            </div>

            {(userData?.role === 'admin' || userData?.role === 'super' || userData?.role === 'master') && (
              <div className="sidebar-section-header mt-4 bg-slate-800">
                <span>Network Management</span>
                <ShieldAlert size={14} />
              </div>
            )}
            <div className="bg-slate-100">
              {userData?.role === 'admin' && (
                <Link href="/admin" className={cn("sidebar-item", pathname === '/admin' && "bg-slate-200 font-bold text-red-600")}>
                  <ShieldAlert size={12} /> Apex Admin
                </Link>
              )}
              {userData?.role === 'super' && (
                <Link href="/super" className={cn("sidebar-item", pathname === '/super' && "bg-slate-200 font-bold text-green-600")}>
                  <ShieldCheck size={12} /> Super Panel
                </Link>
              )}
              {userData?.role === 'master' && (
                <Link href="/master" className={cn("sidebar-item", pathname === '/master' && "bg-slate-200 font-bold text-blue-600")}>
                  <Users size={12} /> Master Hub
                </Link>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
