'use client';

import { useState } from 'react';
import { AlertTriangle, Bell, Eye, Lock, Settings2, Shield, Users } from 'lucide-react';
import { useCoachTeam } from '@/lib/coach/selectedTeam';

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3.5 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-white">{label}</span>
        <span className="mt-0.5 block text-xs text-gray-400">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
          checked
            ? 'border-[rgba(0,212,170,0.5)] bg-[rgba(0,212,170,0.28)]'
            : 'border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.06)]'
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </label>
  );
}

export function CoachSettingsPage() {
  const { teams, selectedTeamId, setSelectedTeamId } = useCoachTeam();

  const [emailDigestEnabled, setEmailDigestEnabled] = useState(true);
  const [pushAlertsEnabled, setPushAlertsEnabled] = useState(true);
  const [calendarRemindersEnabled, setCalendarRemindersEnabled] = useState(true);
  const [playerRiskAlertsEnabled, setPlayerRiskAlertsEnabled] = useState(true);

  const [autoSelectRecentTeam, setAutoSelectRecentTeam] = useState(true);
  const [highlightTeamWarnings, setHighlightTeamWarnings] = useState(true);

  const [compactCardsEnabled, setCompactCardsEnabled] = useState(false);
  const [reducedMotionEnabled, setReducedMotionEnabled] = useState(false);

  const [profileVisibilityTeamOnly, setProfileVisibilityTeamOnly] = useState(true);
  const [allowDataExport, setAllowDataExport] = useState(false);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>
        <p className="mt-2 text-sm text-gray-400">
          Manage account preferences, notifications, team controls, and privacy options.
        </p>
      </header>

      <section className="glass-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-lg border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.06)] p-1.5 text-gray-200">
            <Settings2 size={15} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">Account Settings</h2>
            <p className="mt-1 text-xs text-gray-400">Editable-ready account fields using mock values.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-400">Display Name</p>
            <div className="rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-sm text-white">
              Jordan Williams
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-400">Email</p>
            <div className="rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-sm text-white">
              coach.email@prolaesio.app
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-400">Language</p>
            <div className="rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-sm text-white">
              English (US)
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-400">Timezone</p>
            <div className="rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-sm text-white">
              Pacific Time (PT)
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="glass-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Bell size={16} className="text-[var(--accent-secondary)]" />
            <h2 className="text-sm font-semibold text-white">Notification Preferences</h2>
          </div>
          <div className="space-y-2.5">
            <ToggleRow
              label="Daily Email Digest"
              description="Receive one summary email for key team changes."
              checked={emailDigestEnabled}
              onChange={setEmailDigestEnabled}
            />
            <ToggleRow
              label="Push Alerts"
              description="Get in-app alerts for urgent coaching updates."
              checked={pushAlertsEnabled}
              onChange={setPushAlertsEnabled}
            />
            <ToggleRow
              label="Calendar Reminders"
              description="Notify before events, sessions, and deadlines."
              checked={calendarRemindersEnabled}
              onChange={setCalendarRemindersEnabled}
            />
            <ToggleRow
              label="Player Risk Alerts"
              description="Highlight readiness and recovery risks."
              checked={playerRiskAlertsEnabled}
              onChange={setPlayerRiskAlertsEnabled}
            />
          </div>
        </section>

        <section className="glass-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users size={16} className="text-[var(--accent-primary)]" />
            <h2 className="text-sm font-semibold text-white">Team Management Preferences</h2>
          </div>

          <div className="space-y-2.5">
            <ToggleRow
              label="Auto-select Most Recent Team"
              description="Open coach pages using your last active team."
              checked={autoSelectRecentTeam}
              onChange={setAutoSelectRecentTeam}
            />
            <ToggleRow
              label="Highlight Team Warnings"
              description="Elevate teams with high load and low readiness."
              checked={highlightTeamWarnings}
              onChange={setHighlightTeamWarnings}
            />

            <div className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3.5 py-3">
              <p className="text-sm font-medium text-white">Default Team</p>
              <p className="mt-0.5 text-xs text-gray-400">Used when entering team-specific pages.</p>
              <select
                value={selectedTeamId}
                onChange={(event) => setSelectedTeamId(event.target.value)}
                className="mt-3 w-full appearance-none rounded-lg border border-[rgba(255,255,255,0.16)] bg-[rgba(8,11,28,0.96)] px-3 py-2 text-sm font-medium text-white outline-none transition-colors focus:border-[var(--accent-secondary)]"
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id} className="bg-[var(--background)] text-white">
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="glass-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Eye size={16} className="text-[var(--accent-secondary)]" />
            <h2 className="text-sm font-semibold text-white">Appearance and Display</h2>
          </div>

          <div className="space-y-2.5">
            <ToggleRow
              label="Compact Cards"
              description="Reduce card spacing to display more data."
              checked={compactCardsEnabled}
              onChange={setCompactCardsEnabled}
            />
            <ToggleRow
              label="Reduced Motion"
              description="Minimize transition animations for comfort."
              checked={reducedMotionEnabled}
              onChange={setReducedMotionEnabled}
            />
          </div>
        </section>

        <section className="glass-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Shield size={16} className="text-[var(--accent-primary)]" />
            <h2 className="text-sm font-semibold text-white">Privacy and Data</h2>
          </div>

          <div className="space-y-2.5">
            <ToggleRow
              label="Team-only Profile Visibility"
              description="Limit your profile visibility to assigned teams."
              checked={profileVisibilityTeamOnly}
              onChange={setProfileVisibilityTeamOnly}
            />
            <ToggleRow
              label="Enable Data Export Requests"
              description="Allow future requests to export your account data."
              checked={allowDataExport}
              onChange={setAllowDataExport}
            />

            <div className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3.5 py-3">
              <p className="text-sm font-medium text-white">Session Security</p>
              <p className="mt-0.5 text-xs text-gray-400">Authentication and session policy placeholders.</p>
              <button
                type="button"
                className="mt-3 rounded-lg border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[rgba(255,255,255,0.1)]"
              >
                Review Active Sessions
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className="glass-card border-[rgba(255,107,107,0.24)] p-5">
        <div className="mb-3 flex items-center gap-2 text-[var(--status-red)]">
          <AlertTriangle size={16} />
          <h2 className="text-sm font-semibold">Danger Zone</h2>
        </div>
        <p className="text-sm text-gray-300">
          Future destructive account actions will appear here. These controls are placeholders and are intentionally non-destructive.
        </p>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            className="rounded-lg border border-[rgba(255,107,107,0.4)] bg-[rgba(255,107,107,0.1)] px-3 py-2 text-sm font-semibold text-[var(--status-red)] transition-colors hover:bg-[rgba(255,107,107,0.16)]"
          >
            Request Account Deletion (Coming Soon)
          </button>
          <button
            type="button"
            className="rounded-lg border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.05)] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[rgba(255,255,255,0.1)]"
          >
            Log Out All Devices (Coming Soon)
          </button>
        </div>

        <p className="mt-3 text-xs text-gray-400">
          Supabase-ready note: connect these actions to secure backend flows when account lifecycle features are enabled.
        </p>
      </section>

      <section className="rounded-xl border border-[rgba(74,158,255,0.28)] bg-[rgba(74,158,255,0.08)] px-4 py-3 text-xs text-[var(--accent-secondary)]">
        Settings on this page use local mock state only and do not persist to backend services yet.
      </section>
    </div>
  );
}
