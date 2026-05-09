'use client';

import React, { useState } from 'react';
import { ReadinessChart, LoadChart, FatigueEnergyChart } from '@/components/Charts';

export default function AnalyticsPage() {
  const [days, setDays] = useState<7 | 14 | 30>(7);

  return (
    <div className="px-4 py-8 max-w-md mx-auto h-full flex flex-col pb-20">
      <header className="mb-6 pl-1 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white tracking-tight">Analytics</h1>
      </header>

      {/* Time Range Switcher */}
      <div className="flex bg-[rgba(255,255,255,0.05)] rounded-full p-1 mb-6 border border-[rgba(255,255,255,0.1)]">
        {([7, 14, 30] as const).map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`flex-1 py-2 text-sm font-bold rounded-full transition-all shadow-sm touch-target ${
              days === d 
                ? 'bg-[var(--card-bg)] text-white border border-[rgba(255,255,255,0.1)]' 
                : 'text-gray-400 transparent'
            }`}
          >
            {d} Days
          </button>
        ))}
      </div>

      <div className="space-y-6 animate-slide-up">
        <ReadinessChart days={days} />
        <FatigueEnergyChart days={days} />
        <LoadChart days={days} />
      </div>
    </div>
  );
}
