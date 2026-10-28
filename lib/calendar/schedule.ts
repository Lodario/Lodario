export const CALENDAR_HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** Initial scroll reference only: every hour remains available above and below it. */
export function getCalendarInitialHour(events: ReadonlyArray<{ startHour: number }>): number {
  const startHours = events.map(event => event.startHour).filter(hour => Number.isFinite(hour) && hour >= 0 && hour < 24);
  return startHours.length ? Math.max(0, Math.min(14, Math.floor(Math.min(...startHours)) - 1)) : 6;
}
