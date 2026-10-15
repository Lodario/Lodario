'use client';

import React from 'react';
import { ReadinessChart, LoadChart, FatigueEnergyChart } from '@/components/Charts';
import { AnalyticsHistorySelect } from '@/components/coach/analytics/AnalyticsHistorySelect';
import { useAnalyticsHistoryRange } from '@/lib/useAnalyticsHistoryRange';
import { useData } from '@/lib/DataContext';
import { differenceInCalendarDays, parseISO } from 'date-fns';

export default function AnalyticsPage() {
  const [historyRange, setHistoryRange] = useAnalyticsHistoryRange();
  const { wellnessLogs, trainingLogs } = useData();
  const dates = [...Object.keys(wellnessLogs), ...trainingLogs.map(log => log.date)].sort();
  const days = historyRange === 'unlimited'
    ? Math.max(7, dates[0] ? differenceInCalendarDays(new Date(), parseISO(dates[0])) + 1 : 7)
    : Number(historyRange);

  return (
    <div className="px-4 py-8 max-w-md mx-auto h-full flex flex-col pb-20">
      <header className="mb-6 pl-1 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white tracking-tight">Analytics</h1>
      </header>

      {/* Time Range Switcher */}
      <div className="mb-6">
        <AnalyticsHistorySelect value={historyRange} onChange={setHistoryRange} />
      </div>

      <div className="space-y-6 animate-slide-up">
        <ReadinessChart days={days} />
        <FatigueEnergyChart days={days} />
        <LoadChart days={days} />
      </div>
    </div>
  );
}
