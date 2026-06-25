'use client';

import Link from 'next/link';
import { Bell, ChevronRight, X } from 'lucide-react';
import type { PlayerReminder } from '@/lib/player-reminders';

interface PlayerRemindersProps {
  reminders: PlayerReminder[];
  onDismiss: (id: string) => void;
  className?: string;
}

export function PlayerReminders({ reminders, onDismiss, className = '' }: PlayerRemindersProps) {
  if (reminders.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {reminders.map(reminder => (
        <div
          key={reminder.id}
          className="glass-card p-3 flex items-start gap-3 border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)]"
        >
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--accent-primary-rgb),0.14)] text-[var(--accent-primary)]">
            <Bell size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-snug text-white">{reminder.title}</p>
            {reminder.description && (
              <p className="mt-1 text-xs leading-relaxed text-gray-400">{reminder.description}</p>
            )}
            {reminder.action && (
              <Link
                href={reminder.action.href}
                className="mt-2 inline-flex items-center text-xs font-bold text-[var(--accent-primary)] hover:underline"
              >
                {reminder.action.label}
                <ChevronRight size={14} className="ml-0.5" />
              </Link>
            )}
          </div>
          {reminder.dismissible && (
            <button
              type="button"
              onClick={() => onDismiss(reminder.id)}
              className="touch-target -mr-1 -mt-1 rounded-full p-1.5 text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Dismiss reminder"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
