import { FormEvent, useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { DraftPublishActions } from '@/components/coach/calendar/DraftPublishActions';
import { TaskToggle } from '@/components/coach/calendar/TaskToggle';
import type { TeamEventType } from '@/components/coach/calendar/types';

interface EventCreatorPanelProps {
  teamName: string;
  className?: string;
}

const eventTypeOptions: TeamEventType[] = ['training', 'game', 'gym', 'recovery', 'solo', 'meeting', 'other'];

export function EventCreatorPanel({ teamName, className }: EventCreatorPanelProps) {
  const [isTask, setIsTask] = useState(false);
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<TeamEventType>('training');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('2026-05-19');
  const [startDate, setStartDate] = useState('2026-05-19');
  const [endDate, setEndDate] = useState('2026-05-20');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [lastAction, setLastAction] = useState<'draft' | 'publish' | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <section className={`glass-card flex h-full min-h-0 flex-col p-4 sm:p-5 ${className ?? ''}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Create Team Event</h3>
          <p className="mt-1 text-xs text-gray-400">Target team: {teamName}</p>
        </div>
        <PlusCircle size={18} className="text-[var(--accent-primary)]" />
      </div>

      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <TaskToggle checked={isTask} onChange={setIsTask} />

          {isTask ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Start Date
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-white [color-scheme:dark]"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Start Time
                  <input
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-white"
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  End Date
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-white [color-scheme:dark]"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  End Time
                  <input
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
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
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-white [color-scheme:dark]"
                />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Start Time
                  <input
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-white"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  End Time
                  <input
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-white"
                  />
                </label>
              </div>
            </>
          )}

          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
            Event Title
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
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
                  onClick={() => setEventType(type)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                    eventType === type
                      ? 'bg-[var(--accent-secondary)] text-white'
                      : 'border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] text-gray-300 hover:text-white'
                  }`}
                  aria-pressed={eventType === type}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Session details, outcomes, and completion guidance"
              rows={4}
              className="mt-1.5 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-white placeholder:text-gray-500"
            />
          </label>
        </div>

        <div className="mt-5">
          <DraftPublishActions
            onDraft={() => setLastAction('draft')}
            onPublish={() => setLastAction('publish')}
          />
        </div>

        {lastAction ? (
          <p className="mt-3 rounded-lg border border-[rgba(0,212,170,0.25)] bg-[rgba(0,212,170,0.08)] px-3 py-2 text-xs text-[var(--accent-primary)]">
            {lastAction === 'draft'
              ? `Mock draft saved for ${teamName}. No backend write has been made.`
              : `Mock publish queued for ${teamName}. No backend write has been made.`}
          </p>
        ) : null}
      </form>
    </section>
  );
}
