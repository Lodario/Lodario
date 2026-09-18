'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PlusCircle, Calendar as CalendarIcon, BarChart2, User } from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Log', path: '/log', icon: PlusCircle },
    { name: 'Calendar', path: '/calendar', icon: CalendarIcon },
    { name: 'Analytics', path: '/analytics', icon: BarChart2 },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <div className="player-bottom-nav fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <nav className="max-w-md mx-auto pointer-events-auto">
        <svg width="0" height="0" aria-hidden="true" className="absolute">
          <defs>
            <linearGradient id="player-nav-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="0">
              <stop offset="0%" stopColor="#ffe342" />
              <stop offset="100%" stopColor="#ff4824" />
            </linearGradient>
          </defs>
        </svg>
        <ul className="flex items-center justify-around bg-[var(--card-bg)] border border-[var(--card-border)] rounded-full backdrop-blur-xl px-2 py-3 shadow-2xl">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
            
            return (
              <li key={item.name} className="relative">
                <Link 
                  href={item.path}
                  aria-label={item.name}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all duration-300 ${
                    isActive ? 'text-[var(--accent-primary)]' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Icon size={23} strokeWidth={2} className="transition-colors duration-300" />
                  {isActive && (
                    <span className="absolute -bottom-1 w-1 h-1 bg-[var(--accent-primary)] rounded-full animate-fade-in" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
