'use client';

import React from 'react';
import { useReadiness } from '@/hooks/useReadiness';
import { useData } from '@/lib/DataContext';
import { ReadinessGauge } from '@/components/ReadinessGauge';
import { RecommendationCard } from '@/components/RecommendationCard';
import { format, isSameDay, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, AlertTriangle, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useTrainingLoad } from '@/hooks/useTrainingLoad';
import { buildPlayerDailyContext } from '@/lib/player-context';

export default function Home() {
  const { readiness, recommendation, hasWellnessToday } = useReadiness();
  const { calendarEvents, injuries, profile, wellnessLogs, trainingLogs } = useData();
  const load = useTrainingLoad();
  const guidanceContext = React.useMemo(() => buildPlayerDailyContext({
    profile,
    wellnessLogs,
    trainingLogs,
    calendarEvents,
    injuries,
  }), [profile, wellnessLogs, trainingLogs, calendarEvents, injuries]);

  const activeInjuries = injuries.filter(i => i.status === 'active');
  const showInjuryAlert = activeInjuries.length > 0 || load.hasAutoInjury;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todaysEvents = calendarEvents.filter(e => {
    // simplified check: just matches start day
    return isSameDay(parseISO(e.start), new Date());
  });

  return (
    <div className="px-4 py-8 max-w-md mx-auto">
      <header className="mb-8 pl-1">
        <h1 className="text-3xl font-bold text-white tracking-tight">Lodario</h1>
        <p className="text-sm text-[var(--accent-secondary)] mt-1 font-medium">Your personal training guide</p>
      </header>

      {showInjuryAlert && (
        <div className="mb-6 glass-card p-4 flex items-start space-x-3 bg-[rgba(255,107,107,0.1)] border-[#ff6b6b] animate-slide-up touch-target">
          <ShieldAlert className="text-[#ff6b6b] mt-0.5" size={24} />
          <div>
            <h3 className="text-[#ff6b6b] font-bold text-sm tracking-wide">Active Protocol</h3>
            <p className="text-gray-300 text-xs mt-1 leading-relaxed">
              {load.hasAutoInjury 
                ? "Elevated pain detected over consecutive days. System has engaged injury protocol." 
                : "Active injury logged. Follow your prescribed recovery plan."}
            </p>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="mb-6 flex justify-center">
        <ReadinessGauge score={readiness.score} color={readiness.color} label={readiness.label} />
      </section>

      {/* Breakdowns */}
      <section className="mb-6 grid grid-cols-5 gap-2 animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
        {[
          { label: 'Sleep', score: readiness.breakdown.sleep },
          { label: 'Energy', score: readiness.breakdown.energy },
          { label: 'Fatigue', score: readiness.breakdown.fatigue },
          { label: 'Stress', score: readiness.breakdown.stress },
          { label: 'Load', score: readiness.breakdown.load },
        ].map(item => (
          <div key={item.label} className="glass-card p-2 flex flex-col items-center justify-center">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{item.label}</span>
            <div className="w-full bg-[rgba(255,255,255,0.1)] h-1 rounded-full overflow-hidden mt-1">
              <div 
                className="h-full bg-[var(--accent-primary)] rounded-full transition-all duration-1000"
                style={{ width: `${item.score}%` }} 
              />
            </div>
            <span className="text-xs text-white font-medium mt-1">{item.score}</span>
          </div>
        ))}
      </section>

      {/* Recommendation */}
      <section className="mb-8" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
        <h2 className="text-sm font-bold text-white uppercase tracking-wider pl-1 font-sans">Today&apos;s Guidance</h2>
        {hasWellnessToday ? (
          <RecommendationCard recommendation={recommendation} playerContext={guidanceContext} />
        ) : (
          <div className="mt-4 glass-card p-5 flex flex-col items-center text-center animate-slide-up">
            <div className="w-12 h-12 rounded-full bg-[rgba(255,212,59,0.15)] flex items-center justify-center mb-3">
              <AlertTriangle size={24} className="text-[var(--status-yellow)]" />
            </div>
            <p className="text-sm text-gray-200 font-medium leading-relaxed">
              Complete today&apos;s Daily Wellness check-in to receive an accurate training recommendation.
            </p>
            <Link href="/log" className="mt-3 text-xs font-bold text-[var(--accent-primary)] hover:underline">
              Go to Log Activity &rarr;
            </Link>
          </div>
        )}
      </section>

      {/* Today's Schedule */}
      <section className="mb-12 animate-slide-up" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
        <div className="flex justify-between items-end mb-4 pl-1">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-sans">Schedule</h2>
          <Link href="/calendar" className="text-xs text-[var(--accent-secondary)] font-medium hover:text-[var(--accent-primary)]">
            View All
          </Link>
        </div>
        
        {todaysEvents.length === 0 ? (
          <div className="glass-card p-6 flex flex-col items-center justify-center text-gray-400 border-dashed border-[rgba(255,255,255,0.2)]">
            <CalendarIcon size={32} className="mb-2 opacity-50" />
            <p className="text-sm">No events scheduled today</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todaysEvents.map(event => (
              <div key={event.id} className="glass-card p-4 flex items-center border-l-4 touch-target" style={{ borderLeftColor: event.color || 'var(--accent-primary)' }}>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-white mb-0.5">{event.title}</h4>
                  <p className="text-xs text-gray-400">{format(parseISO(event.start), 'h:mm a')} - {format(parseISO(event.end), 'h:mm a')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
