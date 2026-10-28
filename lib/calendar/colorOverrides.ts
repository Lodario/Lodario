import type { CalendarEvent, CalendarEventColorOverride, CustomEventType } from '@/lib/types';
import { parseCoachCalendarMeta } from '@/lib/calendar/events';

export function resolveCalendarEventColorOverride(
  event: CalendarEvent,
  eventTypeId: string,
  overrides: CalendarEventColorOverride[]
): string | undefined {
  const meta = parseCoachCalendarMeta(event.recurrenceConfig);
  if (!meta?.coachManaged || !meta.coachId) return undefined;

  return (
    overrides.find((override) => override.scope === 'event' && override.eventId === event.id)?.color ??
    overrides.find((override) =>
      override.scope === 'event_type' &&
      override.coachId === meta.coachId &&
      override.eventTypeId === eventTypeId
    )?.color ??
    overrides.find((override) => override.scope === 'coach' && override.coachId === meta.coachId)?.color
  );
}

/** Keep event details, the colour picker and calendar blocks on the same colour. */
export function resolveCalendarEventColor(
  event: CalendarEvent,
  eventTypeId: string,
  overrides: CalendarEventColorOverride[],
  eventTypes: CustomEventType[],
  instanceDate?: string
): string {
  return resolveCalendarEventColorOverride(event, eventTypeId, overrides)
    || (instanceDate ? event.overrides?.[instanceDate]?.color : undefined)
    || event.color
    || eventTypes.find(type => type.id === eventTypeId)?.color
    || '#845ef7';
}
