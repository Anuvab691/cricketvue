'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Menu, X, ShieldAlert, ShieldCheck, Users, 
  ChevronDown, Trophy, Zap, Clock, Star, 
  PlusSquare, PlayCircle, LayoutGrid
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useFirestore, useDoc, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';

export function Sidebar({ userId }: { userId: string }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();

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
          {/* Sports Navigation Structure */}
          <div className="mt-0">
            <div className="sidebar-section-header">
              <span>Racing Sports</span>
              <ChevronDown size={14} />
            </div>
            <div className="bg-slate-50">
              <div className="sidebar-item">Horse Racing</div>
              <div className="sidebar-item">Greyhound Racing</div>
            </div>

            <div className="sidebar-section-header mt-1">
              <span>Others</span>
              <ChevronDown size={14} />
            </div>
            <div className="bg-slate-50">
              <div className="sidebar-item">Our Casino</div>
              <div className="sidebar-item">Our VIP Casino</div>
              <div className="sidebar-item">Our Premium Casino</div>
              <div className="sidebar-item">Our Virtual</div>
              <div className="sidebar-item">Live Casino</div>
              <div className="sidebar-item">Slot Game</div>
              <div className="sidebar-item">Fantasy Game</div>
            </div>

            <div className="sidebar-section-header mt-1">
              <span>All Sports</span>
              <ChevronDown size={14} />
            </div>
            <div className="bg-slate-50">
              <Link href="/dashboard" className={cn("sidebar-item", pathname === '/dashboard' && "bg-slate-200 font-bold text-primary")}>
                <LayoutGrid size={12} /> Dashboard
              </Link>
              <div className="sidebar-item">
                <PlusSquare size={12} className="text-slate-400" /> Politics
              </div>
              <div className="sidebar-item font-bold text-slate-800">
                <Trophy size={12} className="text-primary" /> Cricket
              </div>
              <div className="sidebar-item">
                <PlusSquare size={12} className="text-slate-400" /> Football
              </div>
              <div className="sidebar-item">
                <PlusSquare size={12} className="text-slate-400" /> Tennis
              </div>
              <div className="sidebar-item">
                <PlusSquare size={12} className="text-slate-400" /> Table Tennis
              </div>
              <div className="sidebar-item">
                <PlusSquare size={12} className="text-slate-400" /> Badminton
              </div>
              <div className="sidebar-item">
                <PlusSquare size={12} className="text-slate-400" /> Esoccer
              </div>
            </div>

            {/* Admin Controls */}
            {(userData?.role === 'admin' || userData?.role === 'super' || userData?.role === 'master') && (
              <div className="sidebar-section-header mt-4 bg-slate-800">
                <span>Management</span>
                <ShieldAlert size={14} />
              </div>
            )}
            <div className="bg-slate-100">
              {userData?.role === 'admin' && (
                <Link href="/admin" className="sidebar-item">
                  <ShieldAlert size={12} className="text-red-500" /> Apex Admin
                </Link>
              )}
              {userData?.role === 'super' && (
                <Link href="/super" className="sidebar-item">
                  <ShieldCheck size={12} className="text-green-600" /> Super Panel
                </Link>
              )}
              {userData?.role === 'master' && (
                <Link href="/master" className="sidebar-item">
                  <Users size={12} className="text-blue-600" /> Master Hub
                </Link>
              )}
              <Link href="/my-bets" className="sidebar-item">
                <Clock size={12} /> My Bets
              </Link>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
