'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, isValid, parseISO } from 'date-fns';
import { TrainingForm } from '@/components/TrainingForm';
import { WellnessForm } from '@/components/WellnessForm';
import { SESSION_TYPES, SessionType } from '@/lib/types';
import { useData } from '@/lib/DataContext';
import { useMemo } from 'react';

export function LoggingScreen({ kind }: { kind: 'wellness' | 'training' }) {
  const router = useRouter();
  const params = useSearchParams();
  const { trainingLogs, isLoading } = useData();
  const dateParam = params.get('date');
  const today = format(new Date(), 'yyyy-MM-dd');
  const selectedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && isValid(parseISO(dateParam)) && dateParam <= today ? dateParam : today;
  const sessionType = params.get('sessionType');
  const duration = Number(params.get('duration'));
  const editId = params.get('edit');
  const existingLog = trainingLogs.find(log => log.id === editId);
  const initialValues = useMemo(() => existingLog || {
    sessionType: SESSION_TYPES.includes(sessionType as SessionType) ? sessionType as SessionType : undefined,
    duration: Number.isFinite(duration) && duration > 0 ? duration : undefined,
  }, [existingLog, sessionType, duration]);
  const timeParam = params.get('time');
  const time = timeParam && /^([01]\d|2[0-3]):[0-5]\d$/.test(timeParam) ? timeParam : null;
  const calendarTitle = params.get('title')?.slice(0, 120) || undefined;
  const returnHref = `/log?date=${selectedDate}`;
  const onSaved = () => router.replace(`${returnHref}&saved=${kind}`);
  return (
    <div className="logging-screen">
      <header className="logging-header">
        <button type="button" aria-label="Back to activity log" onClick={() => router.push(returnHref)}><ChevronLeft size={28} /></button>
        <div>
          <h1>{kind === 'wellness' ? 'Morning check-in' : editId ? 'Edit training' : 'Log training'}</h1>
          <p>{selectedDate === today ? 'Today' : format(parseISO(selectedDate), 'EEE, MMM d')}{kind === 'training' && time ? ` · ${time}` : ''}</p>
        </div>
      </header>
      {isLoading ? <p className="log-loading" role="status">Loading your log…</p>
        : editId && !existingLog ? <p className="log-error" role="alert">This session could not be found. Go back to select a session.</p>
        : kind === 'wellness'
          ? <WellnessForm selectedDate={selectedDate} onSaved={onSaved} />
          : <TrainingForm selectedDate={selectedDate} initialValues={initialValues} calendarTitle={editId ? undefined : calendarTitle} calendarTime={editId ? undefined : time || undefined} onSaved={onSaved} />}
    </div>
  );
}
