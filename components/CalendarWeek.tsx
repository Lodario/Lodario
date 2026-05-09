'use client';

import React from 'react';
import { format, addDays, startOfWeek, isSameDay, parseISO, getHours, getDay, isAfter, isBefore } from 'date-fns';
import { CalendarEvent } from '../lib/types';
import { useData } from '../lib/DataContext';
import { Plus } from 'lucide-react';

interface RenderedEvent {
  event: CalendarEvent;
  isRecurringInstance: boolean;
  instanceDate: string;
  startHour: number;
  endHour: number;
  title?: string;
  color: string;
}

interface CalendarWeekProps {
  currentDate: Date;
  onAddEvent: (dateStr: string) => void;
  onEditEvent: (event: CalendarEvent, isRecurringInstance: boolean, instanceDate: string) => void;
}

export function CalendarWeek({ currentDate, onAddEvent, onEditEvent }: CalendarWeekProps) {
  const { calendarEvents, customEventTypes } = useData();

  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));
  const hours = Array.from({ length: 24 }).map((_, i) => i); // 0-23 full day

  const getTypeColor = (typeId: string) => {
    return customEventTypes.find(t => t.id === typeId)?.color || 'var(--accent-primary)';
  };

  // Convert ISO day of week (0=Sun) to our system (1=Mon...7=Sun)
  const jsDateToRecurrenceDay = (jsDay: number): number => {
    return jsDay === 0 ? 7 : jsDay; // Sunday=0 -> 7
  };

  // Expand all events (including recurring) for a given day, returning rendered events
  const getRenderedEventsForDay = (day: Date): RenderedEvent[] => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayOfWeek = jsDateToRecurrenceDay(getDay(day));
    const results: RenderedEvent[] = [];

    calendarEvents.forEach(event => {
      const eventStartDate = event.start.split('T')[0];
      const startTime = event.start.split('T')[1] || '00:00';
      const endTime = event.end.split('T')[1] || '01:00';
      const startHour = parseInt(startTime.split(':')[0], 10);
      const endHour = parseInt(endTime.split(':')[0], 10) || 24;

      // Check if this date is excluded
      if (event.excludedDates?.includes(dateStr)) return;

      // Check for per-date overrides
      const override = event.overrides?.[dateStr];

      let matches = false;
      let isRecurringInstance = false;

      if (event.recurrence === 'none') {
        // Single event: match by date
        if (eventStartDate === dateStr) {
          matches = true;
        }
      } else if (event.recurrence === 'daily') {
        // Daily: appears every day from the original date onwards
        const originalDate = parseISO(eventStartDate);
        if (!isBefore(day, originalDate)) {
          matches = true;
          isRecurringInstance = true;
        }
      } else if (event.recurrence === 'weekly') {
        // Weekly: appears on selected days from the original date onwards
        const originalDate = parseISO(eventStartDate);
        if (!isBefore(day, originalDate) && event.recurrenceConfig?.days?.includes(dayOfWeek)) {
          matches = true;
          isRecurringInstance = true;
        }
      }

      if (matches) {
        // Apply overrides if they exist for this date
        const finalTitle = override?.title !== undefined ? override.title : event.title;
        const finalStartTime = override?.start ? override.start.split('T')[1] || startTime : startTime;
        const finalEndTime = override?.end ? override.end.split('T')[1] || endTime : endTime;
        const finalStartHour = parseInt(finalStartTime.split(':')[0], 10);
        const finalEndHour = parseInt(finalEndTime.split(':')[0], 10) || 24;
        const finalEventTypeId = override?.eventTypeId || event.eventTypeId;

        results.push({
          event,
          isRecurringInstance,
          instanceDate: dateStr,
          startHour: finalStartHour,
          endHour: finalEndHour,
          title: finalTitle,
          color: event.color || getTypeColor(finalEventTypeId),
        });
      }
    });

    return results;
  };

  // Check if a rendered event covers a specific hour
  const getEventsAtHour = (renderedEvents: RenderedEvent[], hour: number) => {
    return renderedEvents.filter(re => hour >= re.startHour && hour < re.endHour);
  };

  // Check if this hour is the start hour of any event
  const isStartHour = (renderedEvents: RenderedEvent[], hour: number) => {
    return renderedEvents.filter(re => re.startHour === hour);
  };

  // Pre-compute events for all days
  const dayEvents = weekDays.map(day => getRenderedEventsForDay(day));

  return (
    <div className="glass-card animate-fade-in overflow-hidden relative">
      {/* Header axis */}
      <div className="flex border-b border-[rgba(255,255,255,0.1)] sticky top-0 bg-[var(--card-bg)] z-10">
        <div className="w-10 flex-shrink-0"></div>
        <div className="flex-1 grid grid-cols-7">
          {weekDays.map((day, idx) => {
            const isToday = isSameDay(day, new Date());
            return (
              <div key={idx} className="flex flex-col items-center py-2 border-l border-[rgba(255,255,255,0.05)]">
                <span className={`text-[10px] font-medium uppercase ${isToday ? 'text-[var(--accent-primary)]' : 'text-gray-400'}`}>
                  {format(day, 'EEE')}
                </span>
                <span className={`text-sm font-bold mt-1 h-6 w-6 flex items-center justify-center rounded-full ${isToday ? 'bg-[var(--accent-primary)] text-black' : 'text-white'}`}>
                  {format(day, 'd')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-y-auto max-h-[60vh] relative pb-20">
        {hours.map(hour => (
          <div key={hour} className="flex min-h-[40px] border-b border-[rgba(255,255,255,0.05)]">
            <div className="w-10 flex-shrink-0 text-[10px] text-gray-500 text-right pr-2 pt-1 font-medium">
              {hour === 0 ? '12a' : hour <= 11 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`}
            </div>
            <div className="flex-1 grid grid-cols-7 relative">
              {weekDays.map((day, dIdx) => {
                const eventsHere = getEventsAtHour(dayEvents[dIdx], hour);
                const startsHere = isStartHour(dayEvents[dIdx], hour);
                const hasEvent = eventsHere.length > 0;
                const dateStr = format(day, 'yyyy-MM-dd');

                return (
                  <div 
                    key={dIdx} 
                    className={`border-l border-[rgba(255,255,255,0.05)] relative group cursor-pointer transition-colors ${
                      hasEvent ? '' : 'hover:bg-[rgba(255,255,255,0.02)]'
                    }`}
                    onClick={(e) => {
                      if (hasEvent) {
                        // Click existing event -> edit
                        e.stopPropagation();
                        const re = eventsHere[0];
                        onEditEvent(re.event, re.isRecurringInstance, re.instanceDate);
                      } else {
                        // Click empty slot -> add
                        onAddEvent(dateStr);
                      }
                    }}
                  >
                    {/* Show + icon only on empty slots */}
                    {!hasEvent && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus size={14} className="text-[var(--accent-secondary)]" />
                      </div>
                    )}

                    {/* Event fill for covered hours */}
                    {hasEvent && (
                      <div
                        className="absolute inset-0 opacity-70"
                        style={{ backgroundColor: eventsHere[0].color }}
                      />
                    )}

                    {/* Event title label only on start hour */}
                    {startsHere.map(re => (
                      <div 
                        key={re.event.id}
                        className="absolute inset-x-0 top-0 text-[8px] p-0.5 leading-tight font-bold text-white z-10 truncate"
                      >
                        {re.title || ''}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
