'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Menu, X, ChevronDown, Trophy, Star, ChevronRight, PlusSquare, ShieldAlert, Users, LayoutDashboard, History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/use-memo-firebase';

export function Sidebar({ userId }: { userId: string }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();

  const userRef = useMemoFirebase(() => {
    if (!firestore || !userId || userId === 'guest') return null;
    return doc(firestore, 'users', userId);
  }, [firestore, userId]);
  const { data: userData } = useDoc(userRef);

  const Section = ({ title, items }: { title: string, items: { name: string, icon?: any, href?: string }[] }) => (
    <div className="mb-0.5">
      <div className="sidebar-section-header">
        <span>{title}</span>
        <ChevronDown size={12} />
      </div>
      <div className="flex flex-col">
        {items.map((item, idx) => (
          item.href ? (
            <Link key={idx} href={item.href} className={cn(
              "sidebar-item",
              pathname === item.href && "bg-slate-300 border-l-4 border-l-primary"
            )}>
              {item.icon && <item.icon size={12} className="text-slate-500" />}
              <span className="flex-1">{item.name}</span>
            </Link>
          ) : (
            <div key={idx} className="sidebar-item">
               {item.icon && <item.icon size={12} className="text-slate-500" />}
               <span className="flex-1">{item.name}</span>
            </div>
          )
        ))}
      </div>
    </div>
  );

  const managementItems = [];
  if (userData?.role === 'admin') {
    managementItems.push({ name: 'Apex Admin Control', icon: ShieldAlert, href: '/admin' });
  }
  if (userData?.role === 'admin' || userData?.role === 'super') {
    managementItems.push({ name: 'Super Panel', icon: Star, href: '/super' });
  }
  if (userData?.role === 'admin' || userData?.role === 'super' || userData?.role === 'master') {
    managementItems.push({ name: 'Master Hub', icon: Users, href: '/master' });
  }

  return (
    <>
      <div className="lg:hidden fixed top-2 left-2 z-50">
        <Button variant="outline" size="icon" className="h-8 w-8 bg-primary text-white" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={16} /> : <Menu size={16} />}
        </Button>
      </div>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-[200px] bg-[#f1f5f9] border-r border-slate-300 transition-transform lg:translate-x-0 overflow-y-auto no-scrollbar pt-12 lg:pt-0 shadow-lg",
        !isOpen && "-translate-x-full"
      )}>
        <div className="p-4 bg-primary/10 border-b border-slate-300 mb-2">
          <div className="flex items-center gap-2 mb-1">
             <LayoutDashboard size={14} className="text-primary" />
             <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Main Menu</span>
          </div>
          <Link href="/dashboard" className="sidebar-item border-none rounded bg-white shadow-sm hover:bg-slate-50">
             <Trophy size={12} className="text-primary" />
             <span className="font-bold">Exchange Home</span>
          </Link>
          <Link href="/my-bets" className="sidebar-item border-none rounded bg-white shadow-sm hover:bg-slate-50 mt-1">
             <History size={12} className="text-slate-500" />
             <span className="font-bold">My Activity</span>
          </Link>
        </div>

        {managementItems.length > 0 && (
          <Section title="Management" items={managementItems} />
        )}

        <Section 
          title="Racing Sports" 
          items={[
            { name: "Horse Racing" },
            { name: "Greyhound Racing" }
          ]} 
        />
        
        <Section 
          title="Others" 
          items={[
            { name: "Our Casino" },
            { name: "Our VIP Casino" },
            { name: "Our Premium Casino" },
            { name: "Our Virtual" },
            { name: "Live Casino" },
            { name: "Slot Game" },
            { name: "Fantasy Game" }
          ]} 
        />

        <div className="sidebar-section-header">
          <span>All Sports</span>
          <ChevronDown size={12} />
        </div>
        <div className="flex flex-col">
          {['Politics', 'Cricket', 'Football', 'Tennis', 'Table Tennis', 'Badminton', 'Esoccer'].map((sport) => (
            <div key={sport} className="sidebar-item font-bold">
               <PlusSquare size={12} className="text-slate-500" />
               <span>{sport}</span>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
