'use client';

import React from 'react';
import { format, addDays, startOfWeek, isSameDay, parseISO, getHours, getDay, getDate, isAfter, isBefore, lastDayOfMonth } from 'date-fns';
import { CalendarEvent } from '../lib/types';
import { useData } from '../lib/DataContext';
import { Plus } from 'lucide-react';

interface RenderedEvent {
  event: CalendarEvent;
  isRecurringInstance: boolean;
  instanceDate: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  title?: string;
  color: string;
}

interface CalendarWeekProps {
  currentDate: Date;
  onAddEvent: (dateStr: string, hour?: number) => void; // Feature 5: optional hour
  onEditEvent: (event: CalendarEvent, isRecurringInstance: boolean, instanceDate: string) => void;
}

// Parse "HH:mm" into { hour, minute }
function parseTime(timeStr: string): { hour: number; minute: number } {
  const parts = timeStr.split(':');
  return { hour: parseInt(parts[0], 10), minute: parseInt(parts[1] || '0', 10) };
}

// Compute what fraction of an hour cell (0-23) this event covers
// Returns { top: fraction from top, height: fraction of cell }
function getHourCellCoverage(
  cellHour: number,
  startHour: number, startMinute: number,
  endHour: number, endMinute: number
): { top: number; height: number } | null {
  const cellStart = cellHour * 60;
  const cellEnd = (cellHour + 1) * 60;
  const evStart = startHour * 60 + startMinute;
  const evEnd = endHour * 60 + endMinute;

  // No overlap
  if (evEnd <= cellStart || evStart >= cellEnd) return null;

  const overlapStart = Math.max(evStart, cellStart);
  const overlapEnd = Math.min(evEnd, cellEnd);
  const top = (overlapStart - cellStart) / 60;
  const height = (overlapEnd - overlapStart) / 60;

  return { top, height };
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

  // Check if a day is past the recurrence end date
  const isPastRecurrenceEnd = (day: Date, endDateStr?: string): boolean => {
    if (!endDateStr) return false;
    return isAfter(day, parseISO(endDateStr));
  };

  // Feature 8: Check if day-of-month matches any of the monthDays config
  // Handles months with fewer days (e.g., 31 -> last day of Feb)
  const matchesMonthDay = (day: Date, monthDays: number[]): boolean => {
    const dayOfMonth = getDate(day);
    const lastDay = getDate(lastDayOfMonth(day));
    return monthDays.some(md => {
      if (md > lastDay) return dayOfMonth === lastDay;
      return dayOfMonth === md;
    });
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
      const parsedStart = parseTime(startTime);
      const parsedEnd = parseTime(endTime);

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
        const originalDate = parseISO(eventStartDate);
        if (!isBefore(day, originalDate) && !isPastRecurrenceEnd(day, event.recurrenceEndDate)) {
          matches = true;
          isRecurringInstance = true;
        }
      } else if (event.recurrence === 'weekly') {
        const originalDate = parseISO(eventStartDate);
        if (!isBefore(day, originalDate) && event.recurrenceConfig?.days?.includes(dayOfWeek) && !isPastRecurrenceEnd(day, event.recurrenceEndDate)) {
          matches = true;
          isRecurringInstance = true;
        }
      } else if (event.recurrence === 'monthly') {
        const originalDate = parseISO(eventStartDate);
        if (!isBefore(day, originalDate) && event.recurrenceConfig?.monthDays && matchesMonthDay(day, event.recurrenceConfig.monthDays) && !isPastRecurrenceEnd(day, event.recurrenceEndDate)) {
          matches = true;
          isRecurringInstance = true;
        }
      }

      if (matches) {
        // Apply overrides if they exist for this date
        const finalTitle = override?.title !== undefined ? override.title : event.title;
        const finalStartTime = override?.start ? override.start.split('T')[1] || startTime : startTime;
        const finalEndTime = override?.end ? override.end.split('T')[1] || endTime : endTime;
        const finalParsedStart = parseTime(finalStartTime);
        const finalParsedEnd = parseTime(finalEndTime);
        const finalEventTypeId = override?.eventTypeId || event.eventTypeId;

        results.push({
          event,
          isRecurringInstance,
          instanceDate: dateStr,
          startHour: finalParsedStart.hour,
          startMinute: finalParsedStart.minute,
          endHour: finalParsedEnd.hour,
          endMinute: finalParsedEnd.minute,
          title: finalTitle,
          color: event.color || getTypeColor(finalEventTypeId),
        });
      }
    });

    return results;
  };

  // Get events that cover a specific hour cell (using minute-level precision)
  const getEventsAtHour = (renderedEvents: RenderedEvent[], hour: number) => {
    return renderedEvents.filter(re => {
      const coverage = getHourCellCoverage(hour, re.startHour, re.startMinute, re.endHour, re.endMinute);
      return coverage !== null;
    });
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

                // Feature 3: Max 2 overlapping events in weekly view
                const displayEvents = eventsHere.slice(0, 2);

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
                        // Click empty slot -> add with hour (Feature 5)
                        onAddEvent(dateStr, hour);
                      }
                    }}
                  >
                    {/* Show + icon only on empty slots */}
                    {!hasEvent && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus size={14} className="text-[var(--accent-secondary)]" />
                      </div>
                    )}

                    {/* Feature 3+4: Event fills with overlap and partial hour support */}
                    {hasEvent && displayEvents.map((re, eIdx) => {
                      const coverage = getHourCellCoverage(hour, re.startHour, re.startMinute, re.endHour, re.endMinute);
                      if (!coverage) return null;
                      
                      const totalSlots = displayEvents.length;
                      const slotWidth = 100 / totalSlots;
                      // Sort by start time: earlier starts go left
                      const sorted = [...displayEvents].sort((a, b) => (a.startHour * 60 + a.startMinute) - (b.startHour * 60 + b.startMinute));
                      const sortedIdx = sorted.indexOf(re);

                      return (
                        <div
                          key={re.event.id}
                          className="absolute opacity-70"
                          style={{
                            backgroundColor: re.color,
                            top: `${coverage.top * 100}%`,
                            height: `${coverage.height * 100}%`,
                            left: totalSlots > 1 ? `${sortedIdx * slotWidth}%` : '0',
                            width: totalSlots > 1 ? `${slotWidth}%` : '100%',
                          }}
                          onClick={(e) => {
                            if (totalSlots > 1) {
                              e.stopPropagation();
                              onEditEvent(re.event, re.isRecurringInstance, re.instanceDate);
                            }
                          }}
                        />
                      );
                    })}

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
