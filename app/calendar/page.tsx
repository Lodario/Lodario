'use client';

import React, { useState } from 'react';
import { CalendarWeek } from '@/components/CalendarWeek';
import { EventModal } from '@/components/EventModal';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { format, subWeeks, addWeeks, subDays, addDays, isSameDay, parseISO, getHours, getDay, isBefore } from 'date-fns';
import { useData } from '@/lib/DataContext';
import { CalendarEvent } from '@/lib/types';

export default function CalendarPage() {
  const [view, setView] = useState<'Day' | 'Week'>('Week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDateForEvent, setSelectedDateForEvent] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>(undefined);
  const [editingIsRecurring, setEditingIsRecurring] = useState(false);
  const [editingInstanceDate, setEditingInstanceDate] = useState<string | undefined>(undefined);

  const handlePrev = () => {
    if (view === 'Week') setCurrentDate(subWeeks(currentDate, 1));
    if (view === 'Day') setCurrentDate(subDays(currentDate, 1));
  };
  
  const handleNext = () => {
    if (view === 'Week') setCurrentDate(addWeeks(currentDate, 1));
    if (view === 'Day') setCurrentDate(addDays(currentDate, 1));
  };

  const handleAddEvent = (dateStr?: string) => {
    setEditingEvent(undefined);
    setEditingIsRecurring(false);
    setEditingInstanceDate(undefined);
    setSelectedDateForEvent(dateStr || format(currentDate, 'yyyy-MM-dd'));
    setShowEventModal(true);
  };

  const handleEditEvent = (event: CalendarEvent, isRecurringInstance: boolean, instanceDate: string) => {
    setEditingEvent(event);
    setEditingIsRecurring(isRecurringInstance);
    setEditingInstanceDate(instanceDate);
    setSelectedDateForEvent(instanceDate);
    setShowEventModal(true);
  };

  const handleCloseModal = () => {
    setShowEventModal(false);
    setEditingEvent(undefined);
    setEditingIsRecurring(false);
    setEditingInstanceDate(undefined);
  };

  const getViewLabel = () => {
    if (view === 'Week') return `Week of ${format(currentDate, 'MMM d')}`;
    if (view === 'Day') return format(currentDate, 'MMM d, yyyy');
  };

  return (
    <div className="px-4 py-8 max-w-md mx-auto h-full flex flex-col relative pb-20">
      <header className="mb-6 pl-1 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Schedule</h1>
        </div>
        <button 
          onClick={() => handleAddEvent()}
          className="bg-[var(--accent-primary)] text-black p-2 rounded-full shadow-lg hover:scale-105 transition-transform touch-target flex items-center justify-center"
        >
          <Plus size={24} />
        </button>
      </header>

      {/* Controls — Day / Week only */}
      <div className="flex justify-between items-center mb-6">
        <div className="bg-[rgba(255,255,255,0.05)] rounded-full p-1 flex">
          {(['Day', 'Week'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                view === v ? 'bg-[var(--card-bg)] text-white shadow' : 'text-gray-500'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center mb-4 glass-card p-2 rounded-full">
        <button onClick={handlePrev} className="p-2 text-gray-400 hover:text-white touch-target">
          <ChevronLeft size={20} />
        </button>
        <span className="font-bold text-white text-sm">
          {getViewLabel()}
        </span>
        <button onClick={handleNext} className="p-2 text-gray-400 hover:text-white touch-target">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Main View Area */}
      <div className="flex-1 min-h-[400px]">
        {view === 'Week' && (
          <CalendarWeek 
            currentDate={currentDate} 
            onAddEvent={handleAddEvent} 
            onEditEvent={handleEditEvent} 
          />
        )}
        {view === 'Day' && (
          <DayView 
            currentDate={currentDate} 
            onAddEvent={handleAddEvent} 
            onEditEvent={handleEditEvent} 
          />
        )}
      </div>

      {showEventModal && (
        <EventModal 
          onClose={handleCloseModal} 
          selectedDate={selectedDateForEvent} 
          existingEvent={editingEvent}
          isRecurringInstance={editingIsRecurring}
          instanceDate={editingInstanceDate}
        />
      )}
    </div>
  );
}

// ---- Inline Day View Component ----

function DayView({ currentDate, onAddEvent, onEditEvent }: { 
  currentDate: Date; 
  onAddEvent: (dateStr: string) => void;
  onEditEvent: (event: CalendarEvent, isRecurringInstance: boolean, instanceDate: string) => void;
}) {
  const { calendarEvents, customEventTypes } = useData();

  const dateStr = format(currentDate, 'yyyy-MM-dd');
  const dayOfWeek = getDay(currentDate) === 0 ? 7 : getDay(currentDate);
  const hours = Array.from({ length: 24 }).map((_, i) => i);

  const getTypeColor = (typeId: string) => {
    return customEventTypes.find(t => t.id === typeId)?.color || 'var(--accent-primary)';
  };

  interface RenderedEvent {
    event: CalendarEvent;
    isRecurringInstance: boolean;
    startHour: number;
    endHour: number;
    title?: string;
    color: string;
  }

  const renderedEvents: RenderedEvent[] = [];

  calendarEvents.forEach(event => {
    const eventStartDate = event.start.split('T')[0];
    const startTime = event.start.split('T')[1] || '00:00';
    const endTime = event.end.split('T')[1] || '01:00';
    const startHour = parseInt(startTime.split(':')[0], 10);
    const endHour = parseInt(endTime.split(':')[0], 10) || 24;

    if (event.excludedDates?.includes(dateStr)) return;

    const override = event.overrides?.[dateStr];
    let matches = false;
    let isRecurringInstance = false;

    if (event.recurrence === 'none') {
      if (eventStartDate === dateStr) matches = true;
    } else if (event.recurrence === 'daily') {
      if (!isBefore(currentDate, parseISO(eventStartDate))) {
        matches = true;
        isRecurringInstance = true;
      }
    } else if (event.recurrence === 'weekly') {
      if (!isBefore(currentDate, parseISO(eventStartDate)) && event.recurrenceConfig?.days?.includes(dayOfWeek)) {
        matches = true;
        isRecurringInstance = true;
      }
    }

    if (matches) {
      const finalTitle = override?.title !== undefined ? override.title : event.title;
      const finalStartTime = override?.start ? override.start.split('T')[1] || startTime : startTime;
      const finalEndTime = override?.end ? override.end.split('T')[1] || endTime : endTime;
      const finalStartHour = parseInt(finalStartTime.split(':')[0], 10);
      const finalEndHour = parseInt(finalEndTime.split(':')[0], 10) || 24;
      const finalEventTypeId = override?.eventTypeId || event.eventTypeId;

      renderedEvents.push({
        event,
        isRecurringInstance,
        startHour: finalStartHour,
        endHour: finalEndHour,
        title: finalTitle,
        color: event.color || getTypeColor(finalEventTypeId),
      });
    }
  });

  const getEventsAtHour = (hour: number) => renderedEvents.filter(re => hour >= re.startHour && hour < re.endHour);
  const getStartsAtHour = (hour: number) => renderedEvents.filter(re => re.startHour === hour);

  return (
    <div className="glass-card animate-fade-in overflow-hidden relative">
      <div className="overflow-y-auto max-h-[60vh] relative pb-20">
        {hours.map(hour => {
          const eventsHere = getEventsAtHour(hour);
          const startsHere = getStartsAtHour(hour);
          const hasEvent = eventsHere.length > 0;

          return (
            <div key={hour} className="flex min-h-[44px] border-b border-[rgba(255,255,255,0.05)]">
              <div className="w-14 flex-shrink-0 text-[11px] text-gray-500 text-right pr-3 pt-1 font-medium">
                {hour === 0 ? '12 AM' : hour <= 11 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
              <div 
                className={`flex-1 relative group cursor-pointer transition-colors ${
                  hasEvent ? '' : 'hover:bg-[rgba(255,255,255,0.02)]'
                }`}
                onClick={() => {
                  if (hasEvent) {
                    const re = eventsHere[0];
                    onEditEvent(re.event, re.isRecurringInstance, dateStr);
                  } else {
                    onAddEvent(dateStr);
                  }
                }}
              >
                {!hasEvent && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus size={16} className="text-[var(--accent-secondary)]" />
                  </div>
                )}
                {hasEvent && (
                  <div className="absolute inset-0 opacity-70 rounded-r" style={{ backgroundColor: eventsHere[0].color }} />
                )}
                {startsHere.map(re => (
                  <div 
                    key={re.event.id}
                    className="relative z-10 p-2 text-sm font-bold text-white truncate"
                  >
                    {re.title || '(No title)'}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
