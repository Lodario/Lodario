'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { historyRangeOptions, type AnalyticsHistoryRange } from '@/components/coach/analytics/historyRange';

const listeners = new Set<() => void>();
const selections = new Map<string, AnalyticsHistoryRange>();
const handleStorage = (event: StorageEvent) => {
  if (event.key !== null && !event.key.startsWith('lodario:analytics:history-range:')) return;
  if (event.key === null) selections.clear();
  else selections.delete(event.key);
  listeners.forEach(listener => listener());
};
const subscribe = (listener: () => void) => {
  if (listeners.size === 0) window.addEventListener('storage', handleStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', handleStorage);
  };
};
const defaultRange = () => '7' as const;

export function useAnalyticsHistoryRange() {
  const { user } = useAuth();
  const key = `lodario:analytics:history-range:${user?.id ?? 'guest'}`;
  const getSnapshot = useCallback((): AnalyticsHistoryRange => {
    if (selections.has(key)) return selections.get(key)!;
    try {
      const saved = window.localStorage.getItem(key);
      if (historyRangeOptions.some(option => option.value === saved)) return saved as AnalyticsHistoryRange;
    } catch { /* Keep the preference in memory when storage is unavailable. */ }
    return '7';
  }, [key]);
  const range = useSyncExternalStore(subscribe, getSnapshot, defaultRange);
  const setRange = useCallback((value: AnalyticsHistoryRange) => {
    selections.set(key, value);
    try { window.localStorage.setItem(key, value); } catch {}
    listeners.forEach(listener => listener());
  }, [key]);
  return [range, setRange] as const;
}
