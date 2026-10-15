'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useData } from '../lib/DataContext';
import { Moon, PersonStanding, Clock3, Pencil } from 'lucide-react';
import { Rating } from './logging/Rating';
import { PainPanel } from './logging/PainPanel';
import { WellnessLog } from '../lib/types';
import { isAutomaticInjuryPainLevel } from '../lib/injury-status';
import { format, isBefore, parseISO, subDays } from 'date-fns';

interface WellnessFormProps {
  onSaved: () => void;
  selectedDate: string; // YYYY-MM-DD
}

export function WellnessForm({ onSaved, selectedDate }: WellnessFormProps) {
  const { wellnessLogs, saveWellnessLog } = useData();
  const existingLog = wellnessLogs[selectedDate];

  const [sleepTime, setSleepTime] = useState('22:00');
  const [wakeTime, setWakeTime] = useState('06:00');
  const [sleepQuality, setSleepQuality] = useState(5);
  const [energy, setEnergy] = useState(5);
  const [fatigue, setFatigue] = useState(5);
  const [stress, setStress] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [painLevel, setPainLevel] = useState(0);
  const [painNotes, setPainNotes] = useState('');
  const [manualInjury, setManualInjury] = useState(false);
  const [notes, setNotes] = useState('');
  const sleepTimesTouchedRef = useRef(false);
  const painActive = painLevel > 0;
  const automaticallyTreatAsInjury = painActive && isAutomaticInjuryPainLevel(painLevel);
  const isInjury = painActive && (manualInjury || automaticallyTreatAsInjury);

  const getPreviousSleepTimes = useCallback(() => {
    const selectedDateObj = parseISO(selectedDate);
    const yesterdayKey = format(subDays(selectedDateObj, 1), 'yyyy-MM-dd');
    const yesterdayLog = wellnessLogs[yesterdayKey];
    if (yesterdayLog) {
      return {
        sleepTime: yesterdayLog.sleepTime,
        wakeTime: yesterdayLog.wakeTime,
      };
    }

    const previousLog = Object.values(wellnessLogs)
      .filter((log) => isBefore(parseISO(log.date), selectedDateObj))
      .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())[0];

    return previousLog
      ? { sleepTime: previousLog.sleepTime, wakeTime: previousLog.wakeTime }
      : null;
  }, [selectedDate, wellnessLogs]);

  // Load existing data if changing date
  useEffect(() => {
    if (existingLog) {
      sleepTimesTouchedRef.current = false;
      setSleepTime(existingLog.sleepTime);
      setWakeTime(existingLog.wakeTime);
      setSleepQuality(existingLog.sleepQuality);
      setEnergy(existingLog.energy);
      setFatigue(existingLog.fatigue);
      setStress(existingLog.stress);
      setPainLevel(existingLog.painActive ? existingLog.painLevel ?? 0 : 0);
      setPainNotes(existingLog.painNotes || '');
      setManualInjury(existingLog.isInjury ?? false);
      setNotes(existingLog.notes || '');
    } else {
      // Defaults map to "average"
      if (!sleepTimesTouchedRef.current) {
        const previousSleepTimes = getPreviousSleepTimes();
        setSleepTime(previousSleepTimes?.sleepTime || '22:00');
        setWakeTime(previousSleepTimes?.wakeTime || '06:00');
      }
      setSleepQuality(5);
      setEnergy(5);
      setFatigue(5);
      setStress(5);
      setPainLevel(0);
      setPainNotes('');
      setManualInjury(false);
      setNotes('');
    }
  }, [existingLog, selectedDate, wellnessLogs, getPreviousSleepTimes]);

  const calculateDuration = () => {
    const sl = sleepTime.split(':').map(Number);
    const wk = wakeTime.split(':').map(Number);
    let slMin = sl[0] * 60 + sl[1];
    let wkMin = wk[0] * 60 + wk[1];
    if (wkMin < slMin) {
      wkMin += 24 * 60; // Next day
    }
    return Number(((wkMin - slMin) / 60).toFixed(1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    setSaving(true);
    const log: WellnessLog = {
      date: selectedDate,
      sleepTime,
      wakeTime,
      sleepDuration: calculateDuration(),
      sleepQuality,
      energy,
      fatigue,
      stress,
      painActive,
      painLevel,
      painNotes: painActive ? painNotes : undefined,
      isInjury,
      notes,
    };
    try {
      await saveWellnessLog(log);
      onSaved();
    } catch {
      setError('Your check-in could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="log-form">
      <fieldset disabled={saving} className="log-form-fields">
        <section className="log-card log-sleep-card">
          <h2 className="log-card-title"><Moon size={25} className="log-moon" fill="currentColor" />Sleep</h2>
          <div className="log-sleep-times">
            <label className="log-time-field"><Clock3 size={20} /><span>Fall asleep</span>
              <span className="log-time-input"><input type="time" required aria-label="Fall asleep" value={sleepTime} onChange={event => { sleepTimesTouchedRef.current = true; setSleepTime(event.target.value); }} /><Pencil size={15} aria-hidden="true" /></span>
            </label>
            <label className="log-time-field"><Clock3 size={20} /><span>Wake up</span>
              <span className="log-time-input"><input type="time" required aria-label="Wake up" value={wakeTime} onChange={event => { sleepTimesTouchedRef.current = true; setWakeTime(event.target.value); }} /><Pencil size={15} aria-hidden="true" /></span>
            </label>
          </div>
          <p className="log-sleep-duration">Sleep duration: {calculateDuration()} h</p>
          <Rating label="Sleep quality" value={sleepQuality} onChange={setSleepQuality} />
        </section>
        <section className="log-card log-body-card">
          <h2 className="log-card-title"><PersonStanding size={28} />Body</h2>
          <Rating label="Energy" value={energy} onChange={setEnergy} />
          <Rating label="Fatigue" value={fatigue} onChange={setFatigue} color="#ff4d78" />
          <Rating label="Stress" value={stress} onChange={setStress} color="#df00ed" />
        </section>
        <PainPanel level={painLevel} onLevelChange={setPainLevel} notes={painNotes} onNotesChange={setPainNotes} injury={manualInjury} onInjuryChange={setManualInjury} />
        {error && <p className="log-error" role="alert">{error}</p>}
        <button type="submit" className="log-save-button">{saving ? 'Saving…' : 'Save check-in'}</button>
        <details className="log-extra-details" open={notes ? true : undefined}>
          <summary>Additional notes <span>Optional</span></summary>
          <label htmlFor="wellness-notes" className="log-field-label">How are you feeling overall?</label>
          <textarea id="wellness-notes" value={notes} onChange={event => setNotes(event.target.value)} className="log-input" rows={2} />
        </details>
      </fieldset>
    </form>
  );
}
