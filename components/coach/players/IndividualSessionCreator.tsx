import { FormEvent, useEffect, useRef, useState } from 'react';
import { ChevronDown, PlusCircle } from 'lucide-react';
import { Toggle } from '@/components/ui/Toggle';
import type { CoachPlayer, PlayerSessionType } from '@/components/coach/players/types';

interface IndividualSessionCreatorProps {
  player: CoachPlayer;
  className?: string;
}

export function IndividualSessionCreator({ player, className }: IndividualSessionCreatorProps) {
  const [isTask, setIsTask] = useState(false);
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<PlayerSessionType>('gym');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('2026-05-19');
  const [startDate, setStartDate] = useState('2026-05-19');
  const [endDate, setEndDate] = useState('2026-05-20');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('09:00');
  const [lastAction, setLastAction] = useState<'draft' | 'publish' | null>(null);
  const [showDraftMenu, setShowDraftMenu] = useState(false);
  const draftMenuRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  useEffect(() => {
    const closeMenuOnOutsideClick = (event: MouseEvent) => {
      if (!draftMenuRef.current?.contains(event.target as Node)) {
        setShowDraftMenu(false);
      }
    };

    document.addEventListener('mousedown', closeMenuOnOutsideClick);
    return () => {
      document.removeEventListener('mousedown', closeMenuOnOutsideClick);
    };
  }, []);

  return (
    <section className={`glass-card p-4 sm:p-5 ${className ?? ''}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Add Individual Session</h3>
          <p className="mt-1 text-xs text-gray-400">Target player: {player.name}</p>
        </div>
        <PlusCircle size={18} className="text-[var(--accent-primary)]" />
      </div>

      <form className="flex h-full flex-col" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <Toggle label="Task mode" checked={isTask} onChange={setIsTask} />

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
              placeholder="e.g. Upper Body Primer"
              className="mt-1.5 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-white placeholder:text-gray-500"
            />
          </label>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Event Type</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(['gym', 'solo'] as const).map((type) => (
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
              placeholder="Task details, notes, and completion guidance"
              rows={4}
              className="mt-1.5 w-full rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-white placeholder:text-gray-500"
            />
          </label>
        </div>

        <div className="mt-5 space-y-2 border-t border-[rgba(255,255,255,0.08)] pt-4">
          <div className="relative" ref={draftMenuRef}>
            <div className="grid grid-cols-[minmax(0,1fr)_44px] overflow-hidden rounded-xl border border-[rgba(255,255,255,0.14)]">
              <button
                type="button"
                onClick={() => {
                  setLastAction('draft');
                  setShowDraftMenu(false);
                }}
                className="bg-[rgba(255,255,255,0.08)] py-3 text-sm font-semibold text-white transition-colors hover:bg-[rgba(255,255,255,0.14)]"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => setShowDraftMenu((previous) => !previous)}
                className="border-l border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.08)] text-gray-200 transition-colors hover:bg-[rgba(255,255,255,0.14)]"
                aria-expanded={showDraftMenu}
                aria-label="Open draft publish options"
              >
                <ChevronDown size={16} className={`mx-auto transition-transform ${showDraftMenu ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {showDraftMenu ? (
              <div className="absolute right-0 top-[calc(100%+6px)] z-20 w-56 rounded-lg border border-[rgba(255,255,255,0.14)] bg-[rgba(10,14,39,0.96)] p-2 shadow-xl">
                <button
                  type="button"
                  disabled
                  className="w-full rounded-md px-3 py-2 text-left text-xs text-gray-500"
                >
                  Scheduled publish (coming soon)
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => {
              setLastAction('publish');
              setShowDraftMenu(false);
            }}
            className="w-full rounded-xl bg-gradient-to-r from-[var(--accent-primary)] to-emerald-500 py-3 text-sm font-bold text-black transition-transform active:scale-[0.99]"
          >
            Save and Publish
          </button>
        </div>

        {lastAction ? (
          <p className="mt-3 rounded-lg border border-[rgba(0,212,170,0.25)] bg-[rgba(0,212,170,0.08)] px-3 py-2 text-xs text-[var(--accent-primary)]">
            {lastAction === 'draft'
              ? `Mock draft saved for ${player.name}. No backend write has been made.`
              : `Mock publish queued for ${player.name}. No backend write has been made.`}
          </p>
        ) : null}
      </form>
    </section>
  );
}
