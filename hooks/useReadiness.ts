import { useMemo } from 'react';
import { format, isSameDay, parseISO, getDay, isBefore } from 'date-fns';
import { useData } from '../lib/DataContext';
import { calculatePlayerReadinessForDate, ReadinessResult } from '../lib/readiness';
import { generateRecommendation, RecommendationResult } from '../lib/recommendations';
import { CalendarEvent } from '../lib/types';

export interface ComprehensiveReadiness {
  readiness: ReadinessResult;
  recommendation: RecommendationResult;
  hasWellnessToday: boolean;
}

export function useReadiness(): ComprehensiveReadiness {
  const { wellnessLogs, trainingLogs, profile, injuries, calendarEvents } = useData();

  return useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayLog = wellnessLogs[todayStr];
    const readinessForDate = calculatePlayerReadinessForDate(
      Object.values(wellnessLogs),
      trainingLogs
    );
    const readinessResult = readinessForDate.readiness;

    // Gather today's calendar events (including recurring) that have anticipatedIntensity
    const today = new Date();
    const dayOfWeek = getDay(today) === 0 ? 7 : getDay(today);
    const todaysEvents: CalendarEvent[] = [];

    calendarEvents.forEach(event => {
      const eventStartDate = event.start.split('T')[0];
      if (event.excludedDates?.includes(todayStr)) return;

      let matches = false;
      if (event.recurrence === 'none') {
        if (eventStartDate === todayStr) matches = true;
      } else if (event.recurrence === 'daily') {
        if (!isBefore(today, parseISO(eventStartDate))) matches = true;
      } else if (event.recurrence === 'weekly') {
        if (!isBefore(today, parseISO(eventStartDate)) && event.recurrenceConfig?.days?.includes(dayOfWeek)) {
          matches = true;
        }
      }

      if (matches) {
        // Apply per-date override if it exists
        const override = event.overrides?.[todayStr];
        const mergedEvent = override ? { ...event, ...override } : event;
        todaysEvents.push(mergedEvent as CalendarEvent);
      }
    });

    const recommendationResult = generateRecommendation(
      readinessResult,
      readinessForDate.load,
      injuries.filter(i => i.status === 'active' || i.status === 'recovering'),
      profile,
      todaysEvents,
      {
        todayWellness: todayLog,
        recentTrainingLogs: trainingLogs.filter(log => log.date === todayStr),
      }
    );

    return {
      readiness: readinessResult,
      recommendation: recommendationResult,
      hasWellnessToday: !!todayLog,
    };
  }, [wellnessLogs, trainingLogs, injuries, profile, calendarEvents]);
}
