import { differenceInCalendarDays, format, parseISO } from 'date-fns';

export type PainSignalSource = 'wellness' | 'training';

export interface PainStatusSignal {
  id: string;
  date: string;
  createdAt?: string | null;
  source: PainSignalSource;
  painActive: boolean;
  painLevel?: number | null;
  painNotes?: string | null;
}

export function isPainReported(signal: PainStatusSignal): boolean {
  return signal.painActive || Boolean(signal.painNotes?.trim());
}

export function sortPainSignalsNewestFirst(signals: PainStatusSignal[]): PainStatusSignal[] {
  return [...signals].sort((first, second) => {
    const dateComparison = second.date.localeCompare(first.date);
    if (dateComparison !== 0) return dateComparison;
    return (second.createdAt ?? '').localeCompare(first.createdAt ?? '');
  });
}

export function getLatestPainStatus(signals: PainStatusSignal[]): PainStatusSignal | null {
  return sortPainSignalsNewestFirst(signals)[0] ?? null;
}

export function describePainSignal(signal: PainStatusSignal): string {
  const notes = signal.painNotes?.trim();
  if (notes) return notes;
  if (signal.painLevel) {
    return `${signal.source === 'wellness' ? 'Morning wellness' : 'Training'} pain reported (level ${signal.painLevel}/10)`;
  }
  return signal.source === 'wellness'
    ? 'Morning wellness injury/pain reported'
    : 'Training injury/pain reported';
}

export function formatReportedAgo(dateKey: string, asOfDate = new Date()): string {
  const daysAgo = differenceInCalendarDays(asOfDate, parseISO(dateKey));
  if (daysAgo <= 0) return 'reported today';
  if (daysAgo === 1) return 'reported 1 day ago';
  return `reported ${daysAgo} days ago`;
}

export function getLocalDateKey(date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}
