'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Menu, X, ChevronDown, Trophy, Star, ChevronRight, PlusSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function Sidebar({ userId }: { userId: string }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const Section = ({ title, items }: { title: string, items: { name: string, icon?: any }[] }) => (
    <div className="mb-0.5">
      <div className="sidebar-section-header">
        <span>{title}</span>
        <ChevronDown size={12} />
      </div>
      <div className="flex flex-col">
        {items.map((item, idx) => (
          <div key={idx} className="sidebar-item">
             {item.icon && <item.icon size={12} className="text-slate-500" />}
             <span className="flex-1">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className="lg:hidden fixed top-2 left-2 z-50">
        <Button variant="outline" size="icon" className="h-8 w-8 bg-primary text-white" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={16} /> : <Menu size={16} />}
        </Button>
      </div>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-[200px] bg-[#f1f5f9] border-r border-slate-300 transition-transform lg:translate-x-0 overflow-y-auto no-scrollbar pt-12 lg:pt-0",
        !isOpen && "-translate-x-full"
      )}>
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
            { name: "Tembo" },
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
