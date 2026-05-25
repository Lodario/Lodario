'use client';

import { BadgeCheck, Camera, Mail, ShieldCheck, UserCircle2, Users } from 'lucide-react';
import { useCoachTeam } from '@/lib/coach/selectedTeam';

interface CoachProfile {
  name: string;
  email: string;
  role: 'Coach';
  specialties: string[];
  location: string;
  phone: string;
  timezone: string;
  experience: string;
  preferredContact: string;
  accountId: string;
  memberSince: string;
}

const mockCoachProfile: CoachProfile = {
  name: 'Jordan Williams',
  email: 'coach.email@prolaesio.app',
  role: 'Coach',
  specialties: ['Load Management', 'Return To Play', 'Sprint Performance', 'Youth Development'],
  location: 'Seattle, WA',
  phone: '+1 (555) 019-2648',
  timezone: 'Pacific Time (PT)',
  experience: '8 years',
  preferredContact: 'Email',
  accountId: 'coach_9d42fa21',
  memberSince: 'January 2025',
};

const mockPlayersByTeamId: Record<string, number> = {
  'whitby-u19': 24,
  'whitby-u17': 22,
  'seattle-u23': 26,
  'ridgeview-w': 23,
};

export function CoachProfilePage() {
  const { teams } = useCoachTeam();

  const connectedTeams = teams.length;
  const totalPlayersCoached = teams.reduce((sum, team) => sum + (mockPlayersByTeamId[team.id] ?? 0), 0);
  const initials = mockCoachProfile.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-white">Profile</h1>
        <p className="mt-2 text-sm text-gray-400">
          Coach profile details, connected teams, and account information.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="glass-card p-5">
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.06)] text-2xl font-semibold text-white">
                  {initials}
                </div>
                <span className="absolute -right-1 bottom-0 rounded-full border border-[rgba(255,255,255,0.16)] bg-[rgba(10,14,39,0.95)] p-1.5 text-gray-300">
                  <Camera size={14} />
                </span>
              </div>

              <h2 className="mt-4 text-lg font-semibold text-white">{mockCoachProfile.name}</h2>
              <p className="mt-1 text-sm text-gray-400">{mockCoachProfile.email}</p>
              <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-[rgba(0,212,170,0.35)] bg-[rgba(0,212,170,0.12)] px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent-primary)]">
                <BadgeCheck size={12} />
                {mockCoachProfile.role}
              </span>
            </div>

            <dl className="mt-5 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-gray-300">Connected Teams</dt>
                <dd className="font-semibold text-white">{connectedTeams}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-gray-300">Total Players Coached</dt>
                <dd className="font-semibold text-[var(--accent-secondary)]">{totalPlayersCoached}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-gray-300">Experience</dt>
                <dd className="font-semibold text-white">{mockCoachProfile.experience}</dd>
              </div>
            </dl>
          </section>

          <section className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white">Coaching Focus</h3>
            <p className="mt-1 text-xs text-gray-400">Primary specialties and performance areas.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {mockCoachProfile.specialties.map((specialty) => (
                <span
                  key={specialty}
                  className="rounded-full border border-[rgba(74,158,255,0.35)] bg-[rgba(74,158,255,0.12)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-secondary)]"
                >
                  {specialty}
                </span>
              ))}
            </div>
          </section>

          <section className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white">Connected Teams</h3>
            <div className="mt-3 space-y-2.5">
              {teams.map((team) => (
                <article
                  key={team.id}
                  className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-white">{team.name}</p>
                    <span className="rounded-md border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-300">
                      {team.code}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </aside>

        <div className="space-y-4">
          <section className="glass-card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Personal Information</h3>
                <p className="mt-1 text-xs text-gray-400">Editable-ready profile fields (mock values).</p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[rgba(255,255,255,0.1)]"
              >
                Edit Details
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-400">Full Name</p>
                <div className="rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-sm text-white">
                  {mockCoachProfile.name}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-400">Email</p>
                <div className="rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-sm text-white">
                  {mockCoachProfile.email}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-400">Phone (optional)</p>
                <div className="rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-sm text-white">
                  {mockCoachProfile.phone}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-wide text-gray-400">Preferred Contact</p>
                <div className="rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-sm text-white">
                  {mockCoachProfile.preferredContact}
                </div>
              </div>
            </div>
          </section>

          <section className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white">Account Information</h3>
            <p className="mt-1 text-xs text-gray-400">Prepared for future Supabase-backed account wiring.</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <article className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3.5 py-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-400">Account ID</p>
                <p className="mt-1 text-sm font-medium text-white">{mockCoachProfile.accountId}</p>
              </article>
              <article className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3.5 py-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-400">Member Since</p>
                <p className="mt-1 text-sm font-medium text-white">{mockCoachProfile.memberSince}</p>
              </article>
              <article className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-[var(--accent-primary)]" />
                  <p className="text-[11px] uppercase tracking-wide text-gray-400">Security</p>
                </div>
                <p className="mt-1 text-sm font-medium text-white">Two-factor setup placeholder</p>
              </article>
              <article className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-[var(--accent-secondary)]" />
                  <p className="text-[11px] uppercase tracking-wide text-gray-400">Primary Contact</p>
                </div>
                <p className="mt-1 text-sm font-medium text-white">{mockCoachProfile.email}</p>
              </article>
            </div>

            <div className="mt-4 rounded-xl border border-[rgba(0,212,170,0.28)] bg-[rgba(0,212,170,0.08)] px-3.5 py-3 text-xs text-[var(--accent-primary)]">
              Supabase-ready note: this page uses mock profile data and can be connected to auth/profile tables later.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
