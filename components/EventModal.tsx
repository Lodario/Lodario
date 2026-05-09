'use client';

import React, { useState } from 'react';
import { CalendarEvent, RecurrenceType } from '../lib/types';
import { useData } from '../lib/DataContext';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface EventModalProps {
  onClose: () => void;
  selectedDate: string; // YYYY-MM-DD
  existingEvent?: CalendarEvent; // if editing
  isRecurringInstance?: boolean; // true when clicking a generated recurring occurrence
  instanceDate?: string; // the specific date of this occurrence (YYYY-MM-DD)
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function EventModal({ onClose, selectedDate, existingEvent, isRecurringInstance, instanceDate }: EventModalProps) {
  const { customEventTypes, saveCalendarEvent, deleteCalendarEvent, saveCustomEventType } = useData();
  
  const isEditing = !!existingEvent;

  const [title, setTitle] = useState(existingEvent?.title || '');
  const [eventTypeId, setEventTypeId] = useState<string>(existingEvent?.eventTypeId || customEventTypes[0]?.id || 'other');
  const [startTime, setStartTime] = useState(existingEvent ? existingEvent.start.split('T')[1]?.substring(0, 5) || '16:00' : '16:00');
  const [endTime, setEndTime] = useState(existingEvent ? existingEvent.end.split('T')[1]?.substring(0, 5) || '18:00' : '18:00');
  const [recurrence, setRecurrence] = useState<RecurrenceType>(existingEvent?.recurrence || 'none');
  const [selectedDays, setSelectedDays] = useState<number[]>(existingEvent?.recurrenceConfig?.days || []);
  const [applyOnlyToThis, setApplyOnlyToThis] = useState(false);
  const [anticipatedIntensity, setAnticipatedIntensity] = useState<'Low' | 'Moderate' | 'High' | undefined>(existingEvent?.anticipatedIntensity);

  // Event types that support anticipated intensity
  const TRAINING_TYPE_IDS = ['team-training', 'personal-training', 'gym', 'match'];
  const showIntensityPicker = TRAINING_TYPE_IDS.includes(eventTypeId);

  const [isCreatingNewType, setIsCreatingNewType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('#845ef7');

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSave = () => {
    let finalEventTypeId = eventTypeId;
    
    if (isCreatingNewType && newTypeName) {
      finalEventTypeId = uuidv4();
      saveCustomEventType({
        id: finalEventTypeId,
        name: newTypeName,
        color: newTypeColor,
        isBuiltIn: false
      });
    }

    // Single-instance edit of a recurring event
    if (isEditing && isRecurringInstance && applyOnlyToThis && instanceDate && existingEvent) {
      const updatedEvent = { ...existingEvent };
      if (!updatedEvent.overrides) updatedEvent.overrides = {};
      updatedEvent.overrides[instanceDate] = {
        title,
        eventTypeId: finalEventTypeId,
        start: `${instanceDate}T${startTime}`,
        end: `${instanceDate}T${endTime}`,
      };
      saveCalendarEvent(updatedEvent);
      onClose();
      return;
    }

    const dateToUse = isEditing && existingEvent ? existingEvent.start.split('T')[0] : selectedDate;

    const event: CalendarEvent = {
      id: isEditing && existingEvent ? existingEvent.id : uuidv4(),
      eventTypeId: finalEventTypeId,
      title: title || undefined,
      start: `${dateToUse}T${startTime}`,
      end: `${dateToUse}T${endTime}`,
      recurrence,
      recurrenceConfig: recurrence === 'weekly' ? { days: selectedDays } : undefined,
      excludedDates: existingEvent?.excludedDates,
      overrides: existingEvent?.overrides,
      anticipatedIntensity: TRAINING_TYPE_IDS.includes(finalEventTypeId) ? anticipatedIntensity : undefined,
    };

    saveCalendarEvent(event);
    onClose();
  };

  const handleDelete = () => {
    if (!existingEvent) return;

    // Single-instance delete of a recurring event
    if (isRecurringInstance && applyOnlyToThis && instanceDate) {
      const updatedEvent = { ...existingEvent };
      if (!updatedEvent.excludedDates) updatedEvent.excludedDates = [];
      updatedEvent.excludedDates.push(instanceDate);
      // Also remove any override for this date
      if (updatedEvent.overrides) {
        delete updatedEvent.overrides[instanceDate];
      }
      saveCalendarEvent(updatedEvent);
    } else {
      deleteCalendarEvent(existingEvent.id);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in touch-none p-4">
      <div className="bg-[var(--background)] w-full max-w-md rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-[rgba(255,255,255,0.1)] animate-slide-up pb-safe">
        
        {/* Header */}
        <div className="border-b border-[rgba(255,255,255,0.1)] p-4 flex justify-between items-center bg-[var(--card-bg)]">
          <h2 className="text-lg font-bold text-white">{isEditing ? 'Edit Event' : 'Add Event'}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full bg-[rgba(255,255,255,0.05)]">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto max-h-[70vh]">
          
          {/* Single-instance toggle for recurring events */}
          {isEditing && isRecurringInstance && (
            <div className="mb-5 p-3 rounded-xl bg-[rgba(74,158,255,0.1)] border border-[rgba(74,158,255,0.2)]">
              <label className="flex items-center space-x-3 cursor-pointer touch-target">
                <input
                  type="checkbox"
                  checked={applyOnlyToThis}
                  onChange={(e) => setApplyOnlyToThis(e.target.checked)}
                  className="w-4 h-4 accent-[var(--accent-secondary)]"
                />
                <span className="text-xs text-gray-200 font-medium">Apply changes only to this event</span>
              </label>
            </div>
          )}

          <div className="mb-5">
            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Event Title <span className="text-gray-600">(optional)</span></label>
            <input 
              type="text" 
              placeholder="e.g. U16 Match vs Rovers"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-xl p-3 text-white focus:border-[var(--accent-primary)] focus:outline-none"
            />
          </div>

          <div className="mb-5">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Event Type</label>
            </div>
            
            {!isCreatingNewType ? (
              <div className="flex flex-wrap gap-2">
                {customEventTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setEventTypeId(type.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                      eventTypeId === type.id 
                        ? 'border-transparent text-black' 
                        : 'border-[rgba(255,255,255,0.1)] text-gray-300'
                    }`}
                    style={eventTypeId === type.id ? { backgroundColor: type.color } : {}}
                  >
                    {type.name}
                  </button>
                ))}
                <button 
                  onClick={() => setIsCreatingNewType(true)}
                  className="px-3 py-2 rounded-lg text-xs font-bold transition-all border border-dashed border-[rgba(255,255,255,0.3)] text-gray-300 flex items-center"
                >
                  <Plus size={14} className="mr-1" /> New
                </button>
              </div>
            ) : (
              <div className="p-3 bg-[rgba(255,255,255,0.05)] rounded-xl border border-[var(--accent-secondary)] animate-fade-in">
                <input 
                  type="text" 
                  placeholder="Custom Type Name"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  className="w-full bg-transparent border-b border-[rgba(255,255,255,0.1)] pb-2 mb-3 text-white text-sm focus:outline-none"
                />
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-gray-400">Color:</span>
                  <input 
                    type="color" 
                    value={newTypeColor}
                    onChange={(e) => setNewTypeColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                  <div className="flex-1"></div>
                  <button 
                    onClick={() => setIsCreatingNewType(false)}
                    className="text-xs text-gray-400 hover:text-white px-2 py-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex space-x-4 mb-5">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Start Time</label>
              <input 
                type="time" 
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-xl p-3 text-white touch-target"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">End Time</label>
              <input 
                type="time" 
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-xl p-3 text-white touch-target"
              />
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Recurrence</label>
            <div className="grid grid-cols-3 gap-2">
              {(['none', 'daily', 'weekly'] as RecurrenceType[]).map(r => (
                <button
                  key={r}
                  onClick={() => setRecurrence(r)}
                  className={`py-2 px-1 rounded-lg text-xs font-medium capitalize touch-target ${
                    recurrence === r 
                      ? 'bg-[var(--accent-secondary)] text-white font-bold' 
                      : 'bg-[rgba(255,255,255,0.05)] text-gray-400 border border-[rgba(255,255,255,0.1)]'
                  }`}
                >
                  {r === 'none' ? 'Once' : r}
                </button>
              ))}
            </div>
          </div>

          {/* Weekly day picker */}
          {recurrence === 'weekly' && (
            <div className="mb-6 animate-fade-in">
              <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Select Days of Week</label>
              <div className="grid grid-cols-7 gap-1">
                {DAY_LABELS.map((label, i) => {
                  const dayNum = i + 1; // 1=Mon ... 7=Sun
                  const isSelected = selectedDays.includes(dayNum);
                  return (
                    <button
                      key={dayNum}
                      onClick={() => toggleDay(dayNum)}
                      className={`py-2 rounded-lg text-xs font-bold transition-all touch-target ${
                        isSelected
                          ? 'bg-[var(--accent-primary)] text-black'
                          : 'bg-[rgba(255,255,255,0.05)] text-gray-400 border border-[rgba(255,255,255,0.1)]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Anticipated Intensity — only for training/gym/match event types */}
          {showIntensityPicker && (
            <div className="mb-6 animate-fade-in">
              <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Anticipated Intensity</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Low', 'Moderate', 'High'] as const).map(level => (
                  <button
                    key={level}
                    onClick={() => setAnticipatedIntensity(level)}
                    className={`py-2 px-1 rounded-lg text-xs font-medium touch-target ${
                      anticipatedIntensity === level
                        ? level === 'High' ? 'bg-[var(--status-red)] text-white font-bold'
                          : level === 'Moderate' ? 'bg-[var(--status-yellow)] text-black font-bold'
                          : 'bg-[var(--status-green)] text-black font-bold'
                        : 'bg-[rgba(255,255,255,0.05)] text-gray-400 border border-[rgba(255,255,255,0.1)]'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <button 
              onClick={handleSave}
              className="w-full bg-gradient-to-r from-[var(--accent-primary)] to-emerald-500 text-black font-bold py-4 rounded-xl shadow-lg flex items-center justify-center touch-target transition-transform active:scale-95"
            >
              <Save className="mr-2" size={20} /> {isEditing ? 'Update Event' : 'Save Event'}
            </button>

            {isEditing && (
              <button 
                onClick={handleDelete}
                className="w-full bg-[rgba(255,107,107,0.1)] border border-[rgba(255,107,107,0.3)] text-[#ff6b6b] font-bold py-3 rounded-xl flex items-center justify-center touch-target transition-transform active:scale-95"
              >
                <Trash2 className="mr-2" size={18} /> {isRecurringInstance && applyOnlyToThis ? 'Delete This Occurrence' : 'Delete Event'}
              </button>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
