import { addDays, differenceInMinutes, format, isAfter, isBefore, parseISO, subDays } from 'date-fns';
import type { CalendarOccurrenceInput } from '@/lib/calendar/events';
import { isBuiltInActivityEventType, parseCoachCalendarMeta, resolveCalendarOccurrence } from '@/lib/calendar/events';
import { computeDurationMinutes, mapCalendarEventToSessionType } from '@/lib/calendarLogSession';
import type { CalendarEvent, CustomEventType, TrainingLog, WellnessLog } from '@/lib/types';

export type PlayerReminderType =
  | 'daily-wellness'
  | 'missed-wellness'
  | 'missed-session-log'
  | 'upcoming-session'
  | 'coach-added-event';

export interface PlayerReminderAction {
  label: string;
  href: string;
}

export interface PlayerReminder {
  id: string;
  type: PlayerReminderType;
  title: string;
  description?: string;
  action?: PlayerReminderAction;
  dismissible: boolean;
  sourceEventId?: string;
}

export interface BuildPlayerRemindersInput {
  wellnessLogs?: Record<string, WellnessLog> | null;
  trainingLogs?: TrainingLog[] | null;
  calendarEvents?: CalendarEvent[] | null;
  customEventTypes?: CustomEventType[] | null;
  now?: Date;
  dismissedReminderIds?: Set<string>;
  seenCoachEventIds?: Set<string>;
}

interface ActivityOccurrence {
  occurrenceId: string;
  eventId: string;
  dateKey: string;
  title: string;
  eventTypeId: string;
  start: Date;
  end: Date;
  durationMinutes: number;
  sessionType: TrainingLog['sessionType'];
  isCoachManaged: boolean;
}

const WELLNESS_REMINDER_HOUR = 10;

function getDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function getTimeParts(value: string): [number, number] {
  const [hour = '0', minute = '0'] = value.split(':');
  return [Number.parseInt(hour, 10) || 0, Number.parseInt(minute, 10) || 0];
}

function combineDateAndTime(dateKey: string, time: string): Date {
  return parseISO(`${dateKey}T${time}`);
}

function getEventDateKey(value: string | undefined, fallback: string): string {
  return value?.split('T')[0] || fallback;
}

function getEventTime(value: string | undefined, fallback: string): string {
  return value?.split('T')[1]?.slice(0, 5) || fallback;
}

function getEventTitle(event: CalendarEvent, customEventTypes: CustomEventType[]): string {
  const eventTypeName = customEventTypes.find(type => type.id === event.eventTypeId)?.name;
  return event.title?.trim() || eventTypeName || 'Session';
}

function isActivityEvent(event: CalendarEvent, customEventTypes: CustomEventType[]): boolean {
  const customType = customEventTypes.find(type => type.id === event.eventTypeId);
  return Boolean(
    customType?.isActivity ||
    isBuiltInActivityEventType(event.eventTypeId) ||
    event.anticipatedIntensity
  );
}

function toOccurrenceInput(event: CalendarEvent, customEventTypes: CustomEventType[]): CalendarOccurrenceInput {
  const startDate = getEventDateKey(event.start, getDateKey(new Date()));
  const endDate = getEventDateKey(event.end, startDate);

  return {
    date: startDate,
    startDate,
    endDate,
    startTime: getEventTime(event.start, '00:00'),
    endTime: getEventTime(event.end, '01:00'),
    kind: 'event',
    title: getEventTitle(event, customEventTypes),
    description: event.description,
    eventTypeId: event.eventTypeId,
    recurrence: event.recurrence,
    recurrenceConfig: event.recurrenceConfig,
    recurrenceEndDate: event.recurrenceEndDate ?? null,
    excludedDates: event.excludedDates,
    overrides: event.overrides,
    anticipatedIntensity: event.anticipatedIntensity ?? null,
  };
}

function getActivityOccurrences(
  calendarEvents: CalendarEvent[],
  customEventTypes: CustomEventType[],
  dateKeys: string[]
): ActivityOccurrence[] {
  const occurrences: ActivityOccurrence[] = [];

  calendarEvents.forEach(event => {
    if (!isActivityEvent(event, customEventTypes)) return;

    const input = toOccurrenceInput(event, customEventTypes);
    const isCoachManaged = parseCoachCalendarMeta(event.recurrenceConfig)?.coachManaged === true;

    dateKeys.forEach(dateKey => {
      const occurrence = resolveCalendarOccurrence(input, dateKey);
      if (!occurrence) return;

      const start = combineDateAndTime(dateKey, occurrence.startTime);
      let end = combineDateAndTime(dateKey, occurrence.endTime);
      if (!isAfter(end, start)) {
        end = addDays(end, 1);
      }

      const [startHour, startMinute] = getTimeParts(occurrence.startTime);
      const [endHour, endMinute] = getTimeParts(occurrence.endTime);
      const durationMinutes = computeDurationMinutes(startHour, startMinute, endHour, endMinute);
      const title = occurrence.title || getEventTitle(event, customEventTypes);
      const sessionType = mapCalendarEventToSessionType(occurrence.eventTypeId, customEventTypes, title);

      occurrences.push({
        occurrenceId: `${event.id}:${dateKey}`,
        eventId: event.id,
        dateKey,
        title,
        eventTypeId: occurrence.eventTypeId,
        start,
        end,
        durationMinutes,
        sessionType,
        isCoachManaged,
      });
    });
  });

  return occurrences.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function hasMatchingTrainingLog(occurrence: ActivityOccurrence, trainingLogs: TrainingLog[]): boolean {
  return trainingLogs.some(log => {
    if (log.date !== occurrence.dateKey) return false;
    if (log.sessionType === occurrence.sessionType) return true;
    return occurrence.sessionType === 'Other';
  });
}

function buildTrainingLogHref(occurrence: ActivityOccurrence): string {
  const params = new URLSearchParams({
    open: 'training',
    date: occurrence.dateKey,
    duration: String(occurrence.durationMinutes),
    sessionType: occurrence.sessionType,
  });
  return `/log?${params.toString()}`;
}

function pushIfVisible(
  reminders: PlayerReminder[],
  reminder: PlayerReminder,
  dismissedReminderIds: Set<string>
): void {
  if (!dismissedReminderIds.has(reminder.id)) {
    reminders.push(reminder);
  }
}

export function buildPlayerReminders(input: BuildPlayerRemindersInput): PlayerReminder[] {
  const now = input.now ?? new Date();
  const wellnessLogs = input.wellnessLogs ?? {};
  const trainingLogs = input.trainingLogs ?? [];
  const calendarEvents = input.calendarEvents ?? [];
  const customEventTypes = input.customEventTypes ?? [];
  const dismissedReminderIds = input.dismissedReminderIds ?? new Set<string>();
  const seenCoachEventIds = input.seenCoachEventIds ?? new Set<string>();

  const todayKey = getDateKey(now);
  const yesterdayKey = getDateKey(subDays(now, 1));
  const tomorrowKey = getDateKey(addDays(now, 1));
  const reminders: PlayerReminder[] = [];

  if (now.getHours() >= WELLNESS_REMINDER_HOUR && !wellnessLogs[todayKey]) {
    pushIfVisible(reminders, {
      id: `daily-wellness:${todayKey}`,
      type: 'daily-wellness',
      title: "Log today's wellness.",
      description: 'A quick check-in keeps readiness guidance useful.',
      action: { label: 'Log wellness', href: '/log' },
      dismissible: true,
    }, dismissedReminderIds);
  }

  if (!wellnessLogs[yesterdayKey]) {
    pushIfVisible(reminders, {
      id: `missed-wellness:${yesterdayKey}`,
      type: 'missed-wellness',
      title: "You missed yesterday's wellness log.",
      description: 'Consistent logs make your trends more reliable.',
      action: { label: 'Log wellness', href: '/log' },
      dismissible: true,
    }, dismissedReminderIds);
  }

  const activityOccurrences = getActivityOccurrences(calendarEvents, customEventTypes, [
    yesterdayKey,
    todayKey,
    tomorrowKey,
  ]);

  activityOccurrences
    .filter(occurrence => {
      const minutesSinceEnd = differenceInMinutes(now, occurrence.end);
      return minutesSinceEnd >= 0 && minutesSinceEnd <= 24 * 60 && !hasMatchingTrainingLog(occurrence, trainingLogs);
    })
    .slice(0, 2)
    .forEach(occurrence => {
      pushIfVisible(reminders, {
        id: `missed-session-log:${occurrence.occurrenceId}`,
        type: 'missed-session-log',
        title: `You forgot to log ${occurrence.title}.`,
        description: 'Add the session so your load stays accurate.',
        action: { label: 'Log session', href: buildTrainingLogHref(occurrence) },
        dismissible: true,
        sourceEventId: occurrence.eventId,
      }, dismissedReminderIds);
    });

  activityOccurrences
    .filter(occurrence => {
      const minutesUntilStart = differenceInMinutes(occurrence.start, now);
      return minutesUntilStart >= 0 && minutesUntilStart <= 60;
    })
    .slice(0, 2)
    .forEach(occurrence => {
      pushIfVisible(reminders, {
        id: `upcoming-session:${occurrence.occurrenceId}`,
        type: 'upcoming-session',
        title: `${occurrence.title} starts in about 1 hour.`,
        description: 'Check your calendar and prepare for the session.',
        action: { label: 'View calendar', href: '/calendar' },
        dismissible: true,
        sourceEventId: occurrence.eventId,
      }, dismissedReminderIds);
    });

  activityOccurrences
    .filter(occurrence => occurrence.isCoachManaged && !seenCoachEventIds.has(occurrence.eventId) && !isBefore(occurrence.end, subDays(now, 1)))
    .slice(0, 2)
    .forEach(occurrence => {
      pushIfVisible(reminders, {
        id: `coach-added-event:${occurrence.eventId}`,
        type: 'coach-added-event',
        title: `Your coach added ${occurrence.title} to your calendar.`,
        description: 'Open the calendar to see the details.',
        action: { label: 'View calendar', href: '/calendar' },
        dismissible: true,
        sourceEventId: occurrence.eventId,
      }, dismissedReminderIds);
    });

  return reminders.slice(0, 5);
}
