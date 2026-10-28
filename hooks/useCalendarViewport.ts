import { useEffect, useRef } from 'react';

/** Reposition only when the period or its reference hour changes, never for event actions. */
export function useCalendarViewport(periodKey: string, initialHour: number) {
  const scheduleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = scheduleRef.current;
    if (!container) return;
    const firstRow = container.querySelector<HTMLElement>('[data-hour="0"]');
    const initialRow = container.querySelector<HTMLElement>(`[data-hour="${initialHour}"]`);
    if (firstRow && initialRow) {
      container.scrollTop = initialRow.offsetTop - firstRow.offsetTop;
    }
  }, [periodKey, initialHour]);
  return scheduleRef;
}
