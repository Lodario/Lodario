'use client';

import React, { useEffect, useId, useState } from 'react';
import { ChevronDown, Dumbbell, Pencil } from 'lucide-react';
import { useData } from '../lib/DataContext';
import { Rating } from './logging/Rating';
import { PainPanel } from './logging/PainPanel';
import { TrainingLog, SESSION_TYPES, SessionType, SprintingOption } from '../lib/types';
import { isAutomaticInjuryPainLevel } from '../lib/injury-status';
import { v4 as uuidv4 } from 'uuid';

interface TrainingFormProps {
  onSaved: () => void;
  selectedDate: string;
  initialValues?: Partial<TrainingLog>;
  calendarTitle?: string;
  calendarTime?: string;
}

const sessionLabels: Record<SessionType, string> = {
  Solo: 'Solo training', Partner: 'Partner training', Team: 'Team training', Match: 'Match',
  Cardio: 'Cardio', HIIT: 'HIIT', Gym: 'Gym', Other: 'Other activity',
};
const defaultPerformanceEnabled = (type: SessionType) => type === 'Team' || type === 'Match';

export function TrainingForm({ onSaved, selectedDate, initialValues, calendarTitle, calendarTime }: TrainingFormProps) {
  const { saveTrainingLog } = useData();
  const [sessionType, setSessionType] = useState<SessionType>(initialValues?.sessionType || 'Team');
  const [duration, setDuration] = useState(initialValues?.duration ? String(initialValues.duration) : '');
  const [distance, setDistance] = useState('');
  const [intensity, setIntensity] = useState(7);
  const [sprinting, setSprinting] = useState<SprintingOption>('no');
  const [performance, setPerformance] = useState(5);
  const [performanceEnabled, setPerformanceEnabled] = useState(defaultPerformanceEnabled(sessionType));
  const [painLevel, setPainLevel] = useState(0);
  const [painNotes, setPainNotes] = useState('');
  const [manualInjury, setManualInjury] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const typeMenuId = useId();
  const isEditing = !!initialValues?.id;
  const painActive = painLevel > 0;
  const isInjury = painActive && (manualInjury || isAutomaticInjuryPainLevel(painLevel));
  const hasCalendarContext = !!(calendarTitle || calendarTime) && sessionType === initialValues?.sessionType;

  useEffect(() => {
    const nextType = initialValues?.sessionType || 'Team';
    setSessionType(nextType);
    setDuration(initialValues?.duration && initialValues.duration > 0 ? String(initialValues.duration) : '');
    setDistance(initialValues?.distance != null ? String(initialValues.distance) : '');
    setIntensity(initialValues?.intensity ?? 7);
    setSprinting(initialValues?.sprinting || 'no');
    setPerformance(initialValues?.performance ?? 5);
    setPerformanceEnabled(initialValues?.id ? initialValues.performance != null : defaultPerformanceEnabled(nextType));
    setPainLevel(initialValues?.painActive ? initialValues.painLevel ?? 0 : 0);
    setPainNotes(initialValues?.painNotes || '');
    setManualInjury(initialValues?.isInjury ?? false);
    setNotes(initialValues?.notes || '');
  }, [initialValues, selectedDate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setError('');
    const durationNum = Number(duration);
    if (!Number.isFinite(durationNum) || durationNum <= 0) {
      setError('Enter an actual duration greater than zero.');
      return;
    }
    const distanceNum = distance === '' ? undefined : Number(distance);
    if (distanceNum != null && (!Number.isFinite(distanceNum) || distanceNum < 0)) {
      setError('Enter a valid distance of zero or more.');
      return;
    }
    const log: TrainingLog = {
      id: initialValues?.id || uuidv4(), date: initialValues?.date || selectedDate,
      sessionType, duration: durationNum, distance: distanceNum, intensity, sprinting,
      performance: performanceEnabled ? performance : undefined,
      painActive, painLevel, painNotes: painActive ? painNotes : undefined, isInjury, notes,
    };
    setSaving(true);
    try {
      await saveTrainingLog(log);
      onSaved();
    } catch {
      setError('Your session could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="log-form">
      <fieldset disabled={saving} className="log-form-fields">
        <section className="log-card log-session-card">
          <button type="button" className="log-session-toggle" aria-expanded={typeMenuOpen} aria-controls={typeMenuId} aria-label="Select session type" onClick={() => setTypeMenuOpen(value => !value)}>
            <Dumbbell size={30} />
            <span><strong>{hasCalendarContext && calendarTitle ? calendarTitle : sessionLabels[sessionType]}</strong>{hasCalendarContext && <small>From your calendar</small>}</span>
            <span className="log-event-type-label">Event type</span>
            <ChevronDown size={21} className={typeMenuOpen ? 'is-open' : ''} />
          </button>
          <div id={typeMenuId} hidden={!typeMenuOpen} className="log-session-menu" role="group" aria-label="Session type">
            {SESSION_TYPES.map(type => <button key={type} type="button" aria-pressed={sessionType === type} onClick={() => {
              setSessionType(type); setPerformanceEnabled(defaultPerformanceEnabled(type)); setTypeMenuOpen(false);
            }}>{sessionLabels[type]}</button>)}
          </div>
          <label htmlFor="training-duration" className="log-duration-label">Actual duration</label>
          <div className="log-duration-options">
            {[30, 45, 60, 75, 90].map(minutes => <button key={minutes} type="button" aria-label={minutes + ' minutes'} aria-pressed={Number(duration) === minutes} onClick={() => setDuration(String(minutes))}>{minutes}</button>)}
            <span className="log-duration-custom"><input id="training-duration" type="number" min="0" step="any" inputMode="decimal" value={duration} placeholder="0" aria-label="Actual duration in minutes" onChange={event => setDuration(event.target.value)} /><span>min</span><Pencil size={13} aria-hidden="true" /></span>
          </div>
        </section>
        <section className="log-card log-effort-card">
          <Rating label="How hard did it feel?" value={intensity} onChange={setIntensity} numbered lowLabel="Easy" highLabel="Max effort" />
        </section>
        <section className="log-card log-performance-card">
          <div className="log-performance-control">
            <button type="button" role="switch" aria-checked={performanceEnabled} aria-label="Record personal performance" onClick={() => setPerformanceEnabled(value => !value)}>{performanceEnabled ? 'On' : 'Off'}</button>
          </div>
          {performanceEnabled ? <Rating label="How was your performance?" value={performance} onChange={setPerformance} color="#ff4d78" numbered lowLabel="Poor" highLabel="Excellent" />
            : <div className="log-performance-off"><h2>How was your performance?</h2><p>No performance rating recorded</p></div>}
        </section>
        <section className="log-card log-sprinting-card">
          <h2>Sprinting</h2>
          <div className="log-sprinting-options" role="group" aria-label="Sprinting">
            {([{ value: 'no', label: 'None' }, { value: 'yes-90-95', label: '90–95%' }, { value: 'yes-100', label: '100%' }] as const).map(option => (
              <button key={option.value} type="button" aria-pressed={sprinting === option.value} onClick={() => setSprinting(option.value)}>{option.label}</button>
            ))}
          </div>
        </section>
        <PainPanel level={painLevel} onLevelChange={setPainLevel} notes={painNotes} onNotesChange={setPainNotes} injury={manualInjury} onInjuryChange={setManualInjury} />
        {error && <p className="log-error" role="alert">{error}</p>}
        <button type="submit" className="log-save-button">{saving ? 'Saving…' : isEditing ? 'Update session' : 'Save session'}</button>
        <details className="log-extra-details" open={notes || distance ? true : undefined}>
          <summary>Notes & distance <span>Optional</span></summary>
          <label htmlFor="training-distance" className="log-field-label">Distance (km)</label>
          <input id="training-distance" type="number" min="0" step="any" value={distance} onChange={event => setDistance(event.target.value)} className="log-input" />
          <label htmlFor="training-notes" className="log-field-label">Session notes</label>
          <textarea id="training-notes" value={notes} onChange={event => setNotes(event.target.value)} rows={2} className="log-input" />
        </details>
      </fieldset>
    </form>
  );
}
