import { addDays, addWeeks, format, isSameDay, parseISO, startOfWeek, subDays, subWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlayerCalendarEvent } from '@/components/coach/players/types';

interface PlayerCalendarProps {
  events: PlayerCalendarEvent[];
  className?: string;
}

interface ParsedEvent extends PlayerCalendarEvent {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

interface EventLayout {
  column: number;
  totalColumns: number;
}

const hours = Array.from({ length: 24 }).map((_, index) => index);

function parseTime(timeStr: string): { hour: number; minute: number } {
  const [hourValue = '0', minuteValue = '0'] = timeStr.split(':');
  return {
    hour: Number.parseInt(hourValue, 10),
    minute: Number.parseInt(minuteValue, 10),
  };
}

function formatHourLabel(hour: number) {
  if (hour === 0) return '12a';
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return '12p';
  return `${hour - 12}p`;
}

function getHourCellCoverage(
  cellHour: number,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number
): { top: number; height: number } | null {
  const cellStart = cellHour * 60;
  const cellEnd = (cellHour + 1) * 60;
  const eventStart = startHour * 60 + startMinute;
  const eventEnd = endHour * 60 + endMinute;

  if (eventEnd <= cellStart || eventStart >= cellEnd) return null;

  const overlapStart = Math.max(eventStart, cellStart);
  const overlapEnd = Math.min(eventEnd, cellEnd);
  const top = (overlapStart - cellStart) / 60;
  const height = (overlapEnd - overlapStart) / 60;

  return { top, height };
}

function computeOverlapGroups(events: ParsedEvent[], maxCols: number): Map<string, EventLayout> {
  const result = new Map<string, EventLayout>();
  if (!events.length) return result;

  const intervals = events
    .map((event) => ({
      id: event.id,
      start: event.startHour * 60 + event.startMinute,
      end: event.endHour * 60 + event.endMinute,
    }))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const clusters: typeof intervals[] = [];
  let currentCluster = [intervals[0]];
  let clusterEnd = intervals[0].end;

  for (let index = 1; index < intervals.length; index += 1) {
    const interval = intervals[index];
    if (interval.start < clusterEnd) {
      currentCluster.push(interval);
      clusterEnd = Math.max(clusterEnd, interval.end);
    } else {
      clusters.push(currentCluster);
      currentCluster = [interval];
      clusterEnd = interval.end;
    }
  }
  clusters.push(currentCluster);

  clusters.forEach((cluster) => {
    const totalColumns = Math.min(cluster.length, maxCols);
    cluster.forEach((interval, index) => {
      const column = Math.min(index, maxCols - 1);
      result.set(interval.id, { column, totalColumns });
    });
  });

  return result;
}

function getEventColor(type: PlayerCalendarEvent['type']) {
  return type === 'gym' ? 'var(--accent-primary)' : 'var(--accent-secondary)';
}

function parseDayEvents(events: PlayerCalendarEvent[], dateString: string): ParsedEvent[] {
  return events
    .filter((event) => event.date === dateString)
    .map((event) => {
      const parsedStart = parseTime(event.startTime);
      const parsedEnd = parseTime(event.endTime);
      const startTotal = parsedStart.hour * 60 + parsedStart.minute;
      let endTotal = parsedEnd.hour * 60 + parsedEnd.minute;
      if (endTotal <= startTotal) {
        endTotal = startTotal + 60;
      }

      return {
        ...event,
        startHour: Math.floor(startTotal / 60),
        startMinute: startTotal % 60,
        endHour: Math.floor(endTotal / 60),
        endMinute: endTotal % 60,
      };
    });
}

function DaySchedule({ date, events }: { date: Date; events: PlayerCalendarEvent[] }) {
  const scheduleRef = useRef<HTMLDivElement>(null);
  const dateKey = format(date, 'yyyy-MM-dd');
  const dayEvents = useMemo(() => parseDayEvents(events, dateKey), [dateKey, events]);
  const layout = useMemo(() => computeOverlapGroups(dayEvents, 4), [dayEvents]);

  useEffect(() => {
    const container = scheduleRef.current;
    if (!container) return;
    const sixAmRow = container.querySelector<HTMLElement>('[data-hour="6"]');
    if (sixAmRow) {
      container.scrollTop = sixAmRow.offsetTop;
    }
  }, [dateKey]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)]">
      <div className="border-b border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2">
        <p className="text-xs uppercase tracking-wide text-gray-400">Day View</p>
        <p className="text-sm font-semibold text-white">{format(date, 'EEEE, MMM d')}</p>
      </div>

      <div ref={scheduleRef} className="min-h-0 flex-1 overflow-y-auto">
        {hours.map((hour) => {
          const eventsHere = dayEvents.filter((event) =>
            getHourCellCoverage(hour, event.startHour, event.startMinute, event.endHour, event.endMinute)
          );
          const startsHere = dayEvents.filter((event) => event.startHour === hour);
          return (
            <div key={hour} data-hour={hour} className="flex min-h-[44px] border-b border-[rgba(255,255,255,0.05)]">
              <div className="w-12 shrink-0 pr-2 pt-1 text-right text-[10px] font-medium text-gray-500">
                {formatHourLabel(hour)}
              </div>
              <div className="relative flex-1 border-l border-[rgba(255,255,255,0.06)]">
                {eventsHere.map((event) => {
                  const coverage = getHourCellCoverage(hour, event.startHour, event.startMinute, event.endHour, event.endMinute);
                  if (!coverage) return null;
                  const eventLayout = layout.get(event.id);
                  const column = eventLayout?.column ?? 0;
                  const totalColumns = eventLayout?.totalColumns ?? 1;
                  const slotWidth = 100 / totalColumns;

                  return (
                    <div
                      key={`${event.id}-${hour}`}
                      className="absolute rounded-r opacity-75"
                      style={{
                        backgroundColor: getEventColor(event.type),
                        top: `${coverage.top * 100}%`,
                        height: `${coverage.height * 100}%`,
                        left: totalColumns > 1 ? `${column * slotWidth}%` : '0',
                        width: totalColumns > 1 ? `${slotWidth}%` : '100%',
                      }}
                    />
                  );
                })}

                {startsHere.map((event) => {
                  const coverage = getHourCellCoverage(hour, event.startHour, event.startMinute, event.endHour, event.endMinute);
                  if (!coverage) return null;
                  const eventLayout = layout.get(event.id);
                  const column = eventLayout?.column ?? 0;
                  const totalColumns = eventLayout?.totalColumns ?? 1;
                  const slotWidth = 100 / totalColumns;

                  return (
                    <div
                      key={`${event.id}-label`}
                      className="pointer-events-none absolute z-10 truncate px-1.5 text-[10px] font-semibold text-white"
                      style={{
                        top: `${coverage.top * 100}%`,
                        left: totalColumns > 1 ? `${column * slotWidth}%` : '0',
                        width: totalColumns > 1 ? `${slotWidth}%` : '100%',
                      }}
                    >
                      {event.title}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekSchedule({ currentDate, events }: { currentDate: Date; events: PlayerCalendarEvent[] }) {
  const scheduleRef = useRef<HTMLDivElement>(null);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = useMemo(() => Array.from({ length: 7 }).map((_, index) => addDays(weekStart, index)), [weekStart]);

  const parsedByDay = useMemo(() => {
    return weekDays.map((day) => parseDayEvents(events, format(day, 'yyyy-MM-dd')));
  }, [events, weekDays]);

  const layoutsByDay = useMemo(() => parsedByDay.map((dayEvents) => computeOverlapGroups(dayEvents, 2)), [parsedByDay]);

  useEffect(() => {
    const container = scheduleRef.current;
    if (!container) return;
    const sixAmRow = container.querySelector<HTMLElement>('[data-hour="6"]');
    if (sixAmRow) {
      container.scrollTop = sixAmRow.offsetTop;
    }
  }, [currentDate]);

  return (
    <div className="hidden h-full min-h-0 md:block">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)]">
        <div className="flex border-b border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]">
          <div className="w-10 shrink-0" />
          <div className="grid flex-1 grid-cols-7">
            {weekDays.map((day) => {
              const today = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className="border-l border-[rgba(255,255,255,0.08)] py-2 text-center">
                  <p className={`text-[10px] uppercase ${today ? 'text-[var(--accent-primary)]' : 'text-gray-400'}`}>
                    {format(day, 'EEE')}
                  </p>
                  <p className={`text-sm font-semibold ${today ? 'text-[var(--accent-primary)]' : 'text-white'}`}>
                    {format(day, 'd')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div ref={scheduleRef} className="min-h-0 flex-1 overflow-y-auto">
          {hours.map((hour) => (
            <div key={hour} data-hour={hour} className="flex min-h-[40px] border-b border-[rgba(255,255,255,0.05)]">
              <div className="w-10 shrink-0 pr-1 pt-1 text-right text-[10px] font-medium text-gray-500">
                {formatHourLabel(hour)}
              </div>
              <div className="grid flex-1 grid-cols-7">
                {weekDays.map((day, dayIndex) => {
                  const dayEvents = parsedByDay[dayIndex];
                  const layout = layoutsByDay[dayIndex];
                  const eventsHere = dayEvents.filter((event) =>
                    getHourCellCoverage(hour, event.startHour, event.startMinute, event.endHour, event.endMinute)
                  );
                  const startsHere = dayEvents.filter((event) => event.startHour === hour);
                  return (
                    <div key={`${day.toISOString()}-${hour}`} className="relative border-l border-[rgba(255,255,255,0.06)]">
                      {eventsHere.map((event) => {
                        const coverage = getHourCellCoverage(hour, event.startHour, event.startMinute, event.endHour, event.endMinute);
                        if (!coverage) return null;
                        const eventLayout = layout.get(event.id);
                        const column = eventLayout?.column ?? 0;
                        const totalColumns = eventLayout?.totalColumns ?? 1;
                        const slotWidth = 100 / totalColumns;

                        return (
                          <div
                            key={`${event.id}-${hour}`}
                            className="absolute opacity-75"
                            style={{
                              backgroundColor: getEventColor(event.type),
                              top: `${coverage.top * 100}%`,
                              height: `${coverage.height * 100}%`,
                              left: totalColumns > 1 ? `${column * slotWidth}%` : '0',
                              width: totalColumns > 1 ? `${slotWidth}%` : '100%',
                            }}
                          />
                        );
                      })}

                      {startsHere.map((event, index) => {
                        const coverage = getHourCellCoverage(hour, event.startHour, event.startMinute, event.endHour, event.endMinute);
                        if (!coverage) return null;
                        const eventLayout = layout.get(event.id);
                        const column = eventLayout?.column ?? 0;
                        const totalColumns = eventLayout?.totalColumns ?? 1;
                        const slotWidth = 100 / totalColumns;
                        const stackedTop = `calc(${coverage.top * 100}% + ${index * 9}px)`;

                        return (
                          <div
                            key={`${event.id}-title`}
                            className="pointer-events-none absolute z-10 truncate px-1 text-[8px] font-semibold text-white"
                            style={{
                              top: stackedTop,
                              left: totalColumns > 1 ? `${column * slotWidth}%` : '0',
                              width: totalColumns > 1 ? `${slotWidth}%` : '100%',
                            }}
                          >
                            {event.title}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PlayerCalendar({ events, className }: PlayerCalendarProps) {
  const firstEventDate = events[0]?.date ?? new Date().toISOString().slice(0, 10);
  const [view, setView] = useState<'Day' | 'Week'>('Week');
  const [currentDate, setCurrentDate] = useState<Date>(() => parseISO(firstEventDate));

  useEffect(() => {
    if (!events.length) return;
    setCurrentDate(parseISO(events[0].date));
  }, [events]);

  const viewLabel = view === 'Week' ? `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')}` : format(currentDate, 'MMM d, yyyy');

  return (
    <section className={`glass-card flex min-h-[620px] flex-col p-4 sm:p-5 ${className ?? ''}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] p-1">
          {(['Day', 'Week'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                view === mode ? 'bg-[var(--card-bg)] text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-2 py-1">
          <button
            type="button"
            onClick={() => (view === 'Week' ? setCurrentDate((date) => subWeeks(date, 1)) : setCurrentDate((date) => subDays(date, 1)))}
            className="rounded-full p-1.5 text-gray-300 transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
            aria-label="Previous period"
          >
            <ChevronLeft size={16} />
          </button>
          <p className="min-w-[148px] text-center text-xs font-semibold text-white">{viewLabel}</p>
          <button
            type="button"
            onClick={() => (view === 'Week' ? setCurrentDate((date) => addWeeks(date, 1)) : setCurrentDate((date) => addDays(date, 1)))}
            className="rounded-full p-1.5 text-gray-300 transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
            aria-label="Next period"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {view === 'Day' ? <DaySchedule date={currentDate} events={events} /> : null}
        {view === 'Week' ? (
          <>
            <div className="md:hidden">
              <DaySchedule date={currentDate} events={events} />
            </div>
            <WeekSchedule currentDate={currentDate} events={events} />
          </>
        ) : null}
      </div>
    </section>
  );
}
