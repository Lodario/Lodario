'use client';

import { parseISO } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TeamAveragesPanel } from '@/components/coach/calendar/TeamAveragesPanel';
import { TeamCalendar } from '@/components/coach/calendar/TeamCalendar';
import type {
  TeamCalendarAssignmentScope,
  TeamCalendarItem,
  TeamCalendarRecurrence,
  TeamCalendarRecurrenceConfig,
  TeamCalendarItemKind,
  TeamCalendarIntensity,
  TeamEventType,
} from '@/components/coach/calendar/types';
import { Toggle } from '@/components/ui/Toggle';
import { useAuth } from '@/lib/AuthContext';
import { withCoachCalendarMeta } from '@/lib/calendar/events';
import { useCoachTeam } from '@/lib/coach/selectedTeam';
import { useCoachSelectedTeamInsights } from '@/lib/coach/teamInsights';
import { supabase } from '@/lib/supabase';

interface TeamPlayerOption {
  id: string;
  name: string;
}

interface CalendarFormState {
  kind: TeamCalendarItemKind;
  title: string;
  eventType: TeamEventType;
  description: string;
  assignmentScope: TeamCalendarAssignmentScope;
  assignedPlayerId: string;
  date: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  recurrence: TeamCalendarRecurrence;
  recurrenceDays: number[];
  recurrenceMonthDays: number[];
  recurrenceEndDate: string;
  anticipatedIntensity?: TeamCalendarIntensity;
}

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const activityTypes = new Set<TeamEventType>(['training', 'game', 'gym', 'recovery', 'solo']);
const eventTypeOptions: TeamEventType[] = ['training', 'game', 'gym', 'recovery', 'solo', 'meeting', 'other'];

function isMissingCalendarDescriptionError(error: { message?: string | null; details?: string | null } | null | undefined): boolean {
  const message = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();
  return message.includes('column calendar_events.description does not exist');
}

function getTodayDateKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeTime(value: string): string {
  const [hourPart = '00', minutePart = '00'] = value.split(':');
  const hour = Number.parseInt(hourPart, 10);
  const minute = Number.parseInt(minutePart, 10);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return '00:00';
  }

  const normalizedHour = Math.max(0, Math.min(23, hour));
  const normalizedMinute = Math.max(0, Math.min(59, minute));
  return `${String(normalizedHour).padStart(2, '0')}:${String(normalizedMinute).padStart(2, '0')}`;
}

function addHours(time: string, hoursToAdd: number): string {
  const [hourPart = '0'] = time.split(':');
  const baseHour = Number.parseInt(hourPart, 10);
  const normalizedHour = Number.isFinite(baseHour) ? Math.max(0, Math.min(23, baseHour + hoursToAdd)) : 0;
  return `${String(normalizedHour).padStart(2, '0')}:00`;
}

function createDefaultForm(players: TeamPlayerOption[], selectedDate = getTodayDateKey(), selectedHour?: number): CalendarFormState {
  const startTime = selectedHour == null ? '09:00' : `${String(selectedHour).padStart(2, '0')}:00`;
  const endTime = addHours(startTime, 1);

  return {
    kind: 'event',
    title: '',
    eventType: 'training',
    description: '',
    assignmentScope: 'team',
    assignedPlayerId: players[0]?.id ?? '',
    date: selectedDate,
    startDate: selectedDate,
    endDate: selectedDate,
    startTime,
    endTime,
    recurrence: 'none',
    recurrenceDays: [],
    recurrenceMonthDays: [],
    recurrenceEndDate: '',
    anticipatedIntensity: undefined,
  };
}

function toTeamEventType(value: string | undefined): TeamEventType {
  if (value === 'training' || value === 'game' || value === 'gym' || value === 'recovery' || value === 'solo' || value === 'meeting') {
    return value;
  }
  return 'other';
}

function formFromItem(item: TeamCalendarItem, players: TeamPlayerOption[], instanceDate?: string): CalendarFormState {
  const fallbackDate = instanceDate ?? item.date;
  const normalizedEventType = toTeamEventType(item.eventTypeId ?? item.type);

  return {
    kind: item.kind,
    title: item.title,
    eventType: normalizedEventType,
    description: item.description ?? '',
    assignmentScope: item.assignmentScope ?? 'team',
    assignedPlayerId: item.assignedPlayerId ?? players[0]?.id ?? '',
    date: fallbackDate,
    startDate: item.startDate ?? item.date,
    endDate: item.endDate ?? item.date,
    startTime: normalizeTime(item.startTime),
    endTime: normalizeTime(item.endTime),
    recurrence: item.recurrence ?? 'none',
    recurrenceDays: item.recurrenceConfig?.days ?? [],
    recurrenceMonthDays: item.recurrenceConfig?.monthDays ?? [],
    recurrenceEndDate: item.recurrenceEndDate ?? '',
    anticipatedIntensity: item.anticipatedIntensity ?? undefined,
  };
}

export function CoachCalendarPage() {
  const { user } = useAuth();
  const { selectedTeam } = useCoachTeam();
  const { players, calendarData: teamData, isLoading, error, reload } = useCoachSelectedTeamInsights(selectedTeam.id);
  const hasCalendarData = teamData.items.length > 0 || teamData.averages.length > 0;
  const teamAveragesContainerRef = useRef<HTMLDivElement>(null);
  const [desktopScheduleHeight, setDesktopScheduleHeight] = useState<number | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedInstanceDate, setSelectedInstanceDate] = useState<string | undefined>(undefined);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const playerOptions = useMemo<TeamPlayerOption[]>(
    () => players.map((dataset) => ({ id: dataset.player.id, name: dataset.player.name })),
    [players]
  );
  const selectedItem = useMemo(
    () => teamData.items.find((item) => item.id === selectedItemId) ?? null,
    [teamData.items, selectedItemId]
  );
  const [form, setForm] = useState<CalendarFormState>(() => createDefaultForm([]));

  useEffect(() => {
    const averagesContainer = teamAveragesContainerRef.current;
    if (!averagesContainer) return;

    const syncScheduleHeight = () => {
      if (window.innerWidth >= 1280) {
        setDesktopScheduleHeight(Math.round(averagesContainer.getBoundingClientRect().height));
      } else {
        setDesktopScheduleHeight(null);
      }
    };

    syncScheduleHeight();

    const resizeObserver = new ResizeObserver(() => {
      syncScheduleHeight();
    });
    resizeObserver.observe(averagesContainer);
    window.addEventListener('resize', syncScheduleHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', syncScheduleHeight);
    };
  }, []);

  useEffect(() => {
    if (selectedItem) {
      setForm(formFromItem(selectedItem, playerOptions, selectedInstanceDate));
      return;
    }

    setForm((previous) => {
      const next = createDefaultForm(playerOptions, previous.date || getTodayDateKey());
      return {
        ...next,
        startTime: previous.startTime,
        endTime: previous.endTime,
      };
    });
  }, [playerOptions, selectedItem, selectedInstanceDate]);

  const resetForm = () => {
    setSelectedItemId(null);
    setSelectedInstanceDate(undefined);
    setSaveError(null);
    setSaveSuccess(null);
    setForm(createDefaultForm(playerOptions));
  };

  const handleSelectItem = (item: TeamCalendarItem, instanceDate: string) => {
    setSelectedItemId(item.id);
    setSelectedInstanceDate(instanceDate);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleSelectSlot = (date: string, hour: number) => {
    setSelectedItemId(null);
    setSelectedInstanceDate(undefined);
    setSaveError(null);
    setSaveSuccess(null);
    setForm((previous) => ({
      ...createDefaultForm(playerOptions, date, hour),
      assignmentScope: previous.assignmentScope,
      assignedPlayerId: previous.assignedPlayerId || playerOptions[0]?.id || '',
      eventType: previous.eventType,
      kind: previous.kind,
      recurrence: previous.recurrence,
      recurrenceDays: previous.recurrenceDays,
      recurrenceMonthDays: previous.recurrenceMonthDays,
      recurrenceEndDate: previous.recurrenceEndDate,
      anticipatedIntensity: previous.anticipatedIntensity,
    }));
  };

  const handleToggleWeekDay = (day: number) => {
    setForm((previous) => ({
      ...previous,
      recurrenceDays: previous.recurrenceDays.includes(day)
        ? previous.recurrenceDays.filter((value) => value !== day)
        : [...previous.recurrenceDays, day],
    }));
  };

  const handleToggleMonthDay = (day: number) => {
    setForm((previous) => {
      if (previous.recurrenceMonthDays.includes(day)) {
        return { ...previous, recurrenceMonthDays: previous.recurrenceMonthDays.filter((value) => value !== day) };
      }

      if (previous.recurrenceMonthDays.length >= 4) {
        return previous;
      }

      return { ...previous, recurrenceMonthDays: [...previous.recurrenceMonthDays, day] };
    });
  };

  const saveEvent = async (publish: boolean) => {
    if (!selectedTeam.id || !user) {
      setSaveError('You must be signed in with a selected team.');
      return;
    }

    const trimmedTitle = form.title.trim();
    if (!trimmedTitle) {
      setSaveError('Event title is required.');
      return;
    }

    if (form.assignmentScope === 'player' && !form.assignedPlayerId) {
      setSaveError('Select a player for individual assignment.');
      return;
    }

    const isTask = form.kind === 'task';
    const startDate = isTask ? form.startDate : form.date;
    const endDate = isTask ? form.endDate : form.date;
    const startTime = normalizeTime(form.startTime);
    const endTime = normalizeTime(form.endTime);
    if (!startDate || !endDate) {
      setSaveError('Select valid dates.');
      return;
    }

    const parsedStartDate = parseISO(startDate);
    const parsedEndDate = parseISO(endDate);
    if (Number.isNaN(parsedStartDate.getTime()) || Number.isNaN(parsedEndDate.getTime())) {
      setSaveError('Select valid dates.');
      return;
    }
    if (parsedEndDate.getTime() < parsedStartDate.getTime()) {
      setSaveError('End date cannot be earlier than start date.');
      return;
    }

    if (form.recurrence === 'weekly' && form.recurrenceDays.length === 0) {
      setSaveError('Choose at least one weekday for weekly recurrence.');
      return;
    }

    if (form.recurrence === 'monthly' && form.recurrenceMonthDays.length === 0) {
      setSaveError('Choose at least one month day for monthly recurrence.');
      return;
    }

    const targetPlayers =
      form.assignmentScope === 'team'
        ? playerOptions.map((player) => player.id)
        : [form.assignedPlayerId].filter((value) => value.length > 0);

    if (targetPlayers.length === 0) {
      setSaveError('No active players are available for this team.');
      return;
    }

    const selectedPlayerStillActive =
      form.assignmentScope === 'team' || playerOptions.some((player) => player.id === form.assignedPlayerId);
    if (!selectedPlayerStillActive) {
      setSaveError('The selected player is no longer active on this team.');
      return;
    }

    const recurrenceConfig: TeamCalendarRecurrenceConfig =
      form.recurrence === 'weekly'
        ? { days: [...form.recurrenceDays].sort((a, b) => a - b) }
        : form.recurrence === 'monthly'
          ? { monthDays: [...form.recurrenceMonthDays].sort((a, b) => a - b) }
          : {};

    const existingEventIds = selectedItem?.sourceEventIds ?? [];
    const eventGroupId =
      selectedItem?.sourceEventGroupId ??
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

    const meta = {
      coachManaged: true,
      coachId: user.id,
      teamId: selectedTeam.id,
      kind: form.kind,
      assignmentScope: form.assignmentScope,
      assignedPlayerId: form.assignmentScope === 'player' ? form.assignedPlayerId : null,
      eventGroupId,
      published: publish,
    } as const;

    const rows = targetPlayers.map((playerId) => ({
      id:
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${playerId.slice(0, 6)}`,
      user_id: playerId,
      event_type_id: form.eventType,
      title: trimmedTitle,
      description: form.description.trim() || null,
      start_time: `${startDate}T${startTime}`,
      end_time: `${endDate}T${endTime}`,
      recurrence: form.recurrence,
      recurrence_config: withCoachCalendarMeta(recurrenceConfig, meta),
      recurrence_end_date: form.recurrence !== 'none' && form.recurrenceEndDate ? form.recurrenceEndDate : null,
      excluded_dates: [],
      overrides: {},
      anticipated_intensity:
        activityTypes.has(form.eventType) && form.anticipatedIntensity ? form.anticipatedIntensity : null,
    }));

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    if (existingEventIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('calendar_events')
        .delete()
        .in('id', existingEventIds);

      if (deleteError) {
        setIsSaving(false);
        setSaveError(deleteError.message || 'Unable to update this calendar event.');
        return;
      }
    }

    const { error: insertError } = await supabase
      .from('calendar_events')
      .insert(rows);

    if (insertError) {
      if (isMissingCalendarDescriptionError(insertError)) {
        const fallbackRows = rows.map(({ description: _description, ...row }) => row);
        const fallbackInsert = await supabase
          .from('calendar_events')
          .insert(fallbackRows);

        if (fallbackInsert.error) {
          setIsSaving(false);
          setSaveError(fallbackInsert.error.message || 'Unable to save this calendar event.');
          return;
        }
      } else {
        setIsSaving(false);
        setSaveError(insertError.message || 'Unable to save this calendar event.');
        return;
      }
    }

    setSaveSuccess(publish ? 'Event saved and published.' : 'Draft saved.');
    setIsSaving(false);
    resetForm();
    reload();
  };

  const deleteSelectedItem = async () => {
    if (!selectedItem || !selectedItem.sourceEventIds?.length) {
      setSaveError('No saved event is selected.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    const { error: deleteError } = await supabase
      .from('calendar_events')
      .delete()
      .in('id', selectedItem.sourceEventIds);

    setIsSaving(false);
    if (deleteError) {
      setSaveError(deleteError.message || 'Unable to delete this calendar event.');
      return;
    }

    setSaveSuccess('Event deleted.');
    resetForm();
    reload();
  };

  if (!selectedTeam.id) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-white">Calendar</h1>
          <p className="mt-2 text-sm text-gray-400">Create or select a team first to view team calendar data.</p>
        </header>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-white">Calendar</h1>
        <p className="mt-2 text-sm text-gray-400">Manage events, tasks, and schedule windows for {selectedTeam.name}.</p>
        <p className="mt-3 text-xs font-medium text-[var(--accent-secondary)]">Selected team: {selectedTeam.name}</p>
        {isLoading ? <p className="mt-2 text-xs text-gray-400">Loading team calendar data...</p> : null}
        {error ? <p className="mt-2 text-xs text-[var(--status-red)]">Unable to load calendar data: {error}</p> : null}
        {!isLoading && !error && !hasCalendarData ? <p className="mt-2 text-xs text-gray-400">No team calendar data yet.</p> : null}
      </header>

      <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)_340px] xl:items-stretch">
        <div ref={teamAveragesContainerRef} className="xl:self-start">
          <TeamAveragesPanel metrics={teamData.averages} />
        </div>
        <TeamCalendar
          items={teamData.items}
          selectedItemId={selectedItemId}
          onSelectItem={handleSelectItem}
          onSelectEmptySlot={handleSelectSlot}
          className="xl:self-start"
          style={desktopScheduleHeight && teamData.averages.length > 0 ? { height: `${desktopScheduleHeight}px` } : undefined}
        />

        <section className="glass-card flex min-h-0 flex-col p-4 sm:p-5 xl:self-start">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">{selectedItem ? 'Edit Calendar Item' : 'Create Calendar Item'}</h2>
              <p className="mt-1 text-xs text-gray-400">Target team: {selectedTeam.name}</p>
            </div>
            {selectedItem?.isDraft ? (
              <span className="rounded-full border border-[rgba(255,212,59,0.35)] bg-[rgba(255,212,59,0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--status-yellow)]">
                Draft
              </span>
            ) : null}
          </div>

          <div className="space-y-4">
            <Toggle
              label="Task mode"
              checked={form.kind === 'task'}
              onChange={(checked) => setForm((previous) => ({ ...previous, kind: checked ? 'task' : 'event' }))}
            />

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Assignment</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(['team', 'player'] as const).map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() =>
                      setForm((previous) => ({
                        ...previous,
                        assignmentScope: scope,
                        assignedPlayerId: previous.assignedPlayerId || playerOptions[0]?.id || '',
                      }))
                    }
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                      form.assignmentScope === scope
                        ? 'border-[var(--accent-secondary)] bg-[rgba(74,158,255,0.16)] text-white'
                        : 'border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] text-gray-300 hover:text-white'
                    }`}
                  >
                    {scope === 'team' ? 'Whole Team' : 'Individual Player'}
                  </button>
                ))}
              </div>
            </div>

            {form.assignmentScope === 'player' ? (
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Player
                <select
                  value={form.assignedPlayerId}
                  onChange={(event) => setForm((previous) => ({ ...previous, assignedPlayerId: event.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-white"
                >
                  {playerOptions.map((player) => (
                    <option key={player.id} value={player.id} className="bg-[#0b1230] text-white">
                      {player.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
              Event Title
              <input
                type="text"
                value={form.title}
                onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
                placeholder="e.g. Team Tactical Primer"
                className="mt-1.5 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-white placeholder:text-gray-500"
              />
            </label>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Event Type</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {eventTypeOptions.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm((previous) => ({ ...previous, eventType: type }))}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                      form.eventType === type
                        ? 'bg-[var(--accent-secondary)] text-white'
                        : 'border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] text-gray-300 hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {activityTypes.has(form.eventType) ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Anticipated Intensity</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(['Low', 'Moderate', 'High'] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setForm((previous) => ({ ...previous, anticipatedIntensity: level }))}
                      className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                        form.anticipatedIntensity === level
                          ? 'bg-[var(--accent-primary)] text-black'
                          : 'border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] text-gray-300 hover:text-white'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
              Description
              <textarea
                value={form.description}
                onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
                rows={3}
                placeholder="Session details, outcomes, and completion guidance."
                className="mt-1.5 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-white placeholder:text-gray-500"
              />
            </label>

            {form.kind === 'task' ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Start Date
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(event) => setForm((previous) => ({ ...previous, startDate: event.target.value }))}
                      className="mt-1.5 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-white [color-scheme:dark]"
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    End Date
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(event) => setForm((previous) => ({ ...previous, endDate: event.target.value }))}
                      className="mt-1.5 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-white [color-scheme:dark]"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Start Time
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(event) => setForm((previous) => ({ ...previous, startTime: event.target.value }))}
                      className="mt-1.5 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    End Time
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(event) => setForm((previous) => ({ ...previous, endTime: event.target.value }))}
                      className="mt-1.5 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-white"
                    />
                  </label>
                </div>
              </>
            ) : (
              <>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Date
                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm((previous) => ({ ...previous, date: event.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-white [color-scheme:dark]"
                  />
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Start Time
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(event) => setForm((previous) => ({ ...previous, startTime: event.target.value }))}
                      className="mt-1.5 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    End Time
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(event) => setForm((previous) => ({ ...previous, endTime: event.target.value }))}
                      className="mt-1.5 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-white"
                    />
                  </label>
                </div>
              </>
            )}

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Recurrence</p>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {(['none', 'daily', 'weekly', 'monthly'] as TeamCalendarRecurrence[]).map((recurrence) => (
                  <button
                    key={recurrence}
                    type="button"
                    onClick={() => setForm((previous) => ({ ...previous, recurrence }))}
                    className={`rounded-lg px-2 py-2 text-xs font-semibold capitalize transition-colors ${
                      form.recurrence === recurrence
                        ? 'bg-[var(--accent-secondary)] text-white'
                        : 'border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] text-gray-300 hover:text-white'
                    }`}
                  >
                    {recurrence === 'none' ? 'Once' : recurrence}
                  </button>
                ))}
              </div>
            </div>

            {form.recurrence === 'weekly' ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Weekdays</p>
                <div className="mt-2 grid grid-cols-7 gap-1">
                  {dayLabels.map((label, index) => {
                    const day = index + 1;
                    const isSelected = form.recurrenceDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleToggleWeekDay(day)}
                        className={`rounded-lg px-1 py-2 text-[11px] font-semibold transition-colors ${
                          isSelected
                            ? 'bg-[var(--accent-primary)] text-black'
                            : 'border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] text-gray-300 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {form.recurrence === 'monthly' ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Month Days (max 4)</p>
                <div className="mt-2 grid grid-cols-7 gap-1">
                  {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => {
                    const isSelected = form.recurrenceMonthDays.includes(day);
                    const isDisabled = !isSelected && form.recurrenceMonthDays.length >= 4;
                    return (
                      <button
                        key={day}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleToggleMonthDay(day)}
                        className={`rounded-lg px-1 py-1.5 text-[10px] font-semibold transition-colors ${
                          isSelected
                            ? 'bg-[var(--accent-primary)] text-black'
                            : isDisabled
                              ? 'border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] text-gray-600'
                              : 'border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] text-gray-300 hover:text-white'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
                {form.recurrenceMonthDays.length > 0 ? (
                  <p className="mt-1.5 text-[10px] text-gray-400">
                    Selected: {[...form.recurrenceMonthDays].sort((a, b) => a - b).join(', ')}
                  </p>
                ) : null}
              </div>
            ) : null}

            {form.recurrence !== 'none' ? (
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Recurrence End Date (optional)
                <input
                  type="date"
                  value={form.recurrenceEndDate}
                  onChange={(event) => setForm((previous) => ({ ...previous, recurrenceEndDate: event.target.value }))}
                  min={form.kind === 'task' ? form.startDate : form.date}
                  className="mt-1.5 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-white [color-scheme:dark]"
                />
              </label>
            ) : null}

            {saveError ? (
              <p className="rounded-lg border border-[rgba(255,107,107,0.35)] bg-[rgba(255,107,107,0.12)] px-3 py-2 text-xs text-[var(--status-red)]">
                {saveError}
              </p>
            ) : null}
            {saveSuccess ? (
              <p className="rounded-lg border border-[rgba(0,212,170,0.3)] bg-[rgba(0,212,170,0.1)] px-3 py-2 text-xs text-[var(--accent-primary)]">
                {saveSuccess}
              </p>
            ) : null}

            <div className="space-y-2 border-t border-[rgba(255,255,255,0.08)] pt-4">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void saveEvent(false)}
                className="w-full rounded-xl border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.08)] py-3 text-sm font-semibold text-white transition-colors hover:bg-[rgba(255,255,255,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save as Draft
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void saveEvent(true)}
                className="w-full rounded-xl bg-gradient-to-r from-[var(--accent-primary)] to-emerald-500 py-3 text-sm font-bold text-black transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Save and Publish'}
              </button>
              {selectedItem ? (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void deleteSelectedItem()}
                  className="w-full rounded-xl border border-[rgba(255,107,107,0.32)] bg-[rgba(255,107,107,0.1)] py-3 text-sm font-semibold text-[#ff6b6b] transition-colors hover:bg-[rgba(255,107,107,0.14)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Delete Event
                </button>
              ) : null}
              {selectedItem ? (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={resetForm}
                  className="w-full rounded-xl border border-[rgba(255,255,255,0.14)] bg-transparent py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-300 transition-colors hover:text-white"
                >
                  New Event
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
