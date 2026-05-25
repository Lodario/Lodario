'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  ArrowUpRight,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  Layers,
  LineChart,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { TeamCalendar } from '@/components/coach/calendar/TeamCalendar';
import { getTeamCalendarData } from '@/components/coach/calendar/mockData';
import type { TeamCalendarItem } from '@/components/coach/calendar/types';
import { useCoachTeam } from '@/lib/coach/selectedTeam';

type TeamStatus = 'stable' | 'high-load' | 'needs-attention';

interface TeamSnapshot {
  players: number;
  averageReadiness: number;
  averageLoad: number;
  averageFatigue: number;
  flaggedPlayers: number;
}

interface TeamStatusBadge {
  label: string;
  className: string;
}

interface UpcomingActivity {
  id: string;
  teamId: string;
  title: string;
  type: 'Game' | 'Training' | 'Gym' | 'Recovery' | 'Task';
  startsAt: string;
  status?: 'Confirmed' | 'Draft' | 'Needs Review' | 'Completed';
}

interface CoachAlert {
  id: string;
  teamId: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  href: string;
}

const mockTeamSnapshots: Record<string, TeamSnapshot> = {
  'whitby-u19': {
    players: 24,
    averageReadiness: 84,
    averageLoad: 611,
    averageFatigue: 5.1,
    flaggedPlayers: 1,
  },
  'whitby-u17': {
    players: 22,
    averageReadiness: 76,
    averageLoad: 657,
    averageFatigue: 6.8,
    flaggedPlayers: 3,
  },
  'seattle-u23': {
    players: 26,
    averageReadiness: 72,
    averageLoad: 689,
    averageFatigue: 7.2,
    flaggedPlayers: 4,
  },
  'ridgeview-w': {
    players: 23,
    averageReadiness: 86,
    averageLoad: 577,
    averageFatigue: 4.9,
    flaggedPlayers: 1,
  },
};

const mockUpcomingActivities: UpcomingActivity[] = [
  {
    id: 'activity-1',
    teamId: 'seattle-u23',
    title: 'High-Intensity Match Prep',
    type: 'Training',
    startsAt: '2026-05-25T16:00:00.000Z',
    status: 'Confirmed',
  },
  {
    id: 'activity-2',
    teamId: 'whitby-u19',
    title: 'League Match vs Northbridge',
    type: 'Game',
    startsAt: '2026-05-25T19:30:00.000Z',
    status: 'Confirmed',
  },
  {
    id: 'activity-3',
    teamId: 'ridgeview-w',
    title: 'Lower-Body Strength Block',
    type: 'Gym',
    startsAt: '2026-05-26T09:00:00.000Z',
    status: 'Draft',
  },
  {
    id: 'activity-4',
    teamId: 'whitby-u17',
    title: 'Recovery Mobility Circuit',
    type: 'Recovery',
    startsAt: '2026-05-26T13:00:00.000Z',
    status: 'Confirmed',
  },
  {
    id: 'activity-5',
    teamId: 'seattle-u23',
    title: 'Player Sleep Log Submission',
    type: 'Task',
    startsAt: '2026-05-27T08:00:00.000Z',
    status: 'Needs Review',
  },
];

const mockCoachAlerts: CoachAlert[] = [
  {
    id: 'alert-1',
    teamId: 'seattle-u23',
    title: 'Very low readiness in key starter',
    description: '1 player dropped below readiness 60 after two high-load days.',
    severity: 'high',
    href: '/coach/players',
  },
  {
    id: 'alert-2',
    teamId: 'whitby-u17',
    title: 'Team load trend rising too quickly',
    description: 'Acute load is 12% above last week and fatigue is elevated.',
    severity: 'medium',
    href: '/coach/analytics',
  },
  {
    id: 'alert-3',
    teamId: 'ridgeview-w',
    title: 'Missed recovery task checks',
    description: '3 players missed yesterday evening recovery confirmations.',
    severity: 'low',
    href: '/coach/calendar',
  },
  {
    id: 'alert-4',
    teamId: 'seattle-u23',
    title: 'Poor sleep trend detected',
    description: 'Average sleep score has dropped for three straight sessions.',
    severity: 'medium',
    href: '/coach/players',
  },
];

const quickActions = [
  {
    label: 'Create Team Event',
    description: 'Schedule a team event or task.',
    href: '/coach/calendar',
    icon: CalendarPlus,
  },
  {
    label: 'View Teams',
    description: 'Manage active team selection.',
    href: '/coach/teams',
    icon: Users,
  },
  {
    label: 'View Selected Team Overview',
    description: 'Open the current team control room.',
    href: '/coach/overview',
    icon: Layers,
  },
  {
    label: 'View Analytics',
    description: 'Review readiness and load trends.',
    href: '/coach/analytics',
    icon: LineChart,
  },
  {
    label: 'View Calendar',
    description: 'Manage activities and tasks.',
    href: '/coach/calendar',
    icon: CalendarDays,
  },
];

function getTeamStatus(snapshot: TeamSnapshot): TeamStatus {
  if (snapshot.averageReadiness < 75 || snapshot.flaggedPlayers >= 3 || snapshot.averageFatigue >= 7) {
    return 'needs-attention';
  }

  if (snapshot.averageLoad >= 645 || snapshot.averageFatigue >= 6.4) {
    return 'high-load';
  }

  return 'stable';
}

function getTeamStatusBadge(status: TeamStatus): TeamStatusBadge {
  if (status === 'needs-attention') {
    return {
      label: 'Needs Attention',
      className:
        'border-[rgba(255,107,107,0.42)] bg-[rgba(255,107,107,0.15)] text-[var(--status-red)]',
    };
  }

  if (status === 'high-load') {
    return {
      label: 'High Load',
      className:
        'border-[rgba(255,146,43,0.42)] bg-[rgba(255,146,43,0.15)] text-[var(--status-orange)]',
    };
  }

  return {
    label: 'Stable',
    className:
      'border-[rgba(0,212,170,0.35)] bg-[rgba(0,212,170,0.12)] text-[var(--accent-primary)]',
  };
}

function getAlertSeverityClass(severity: CoachAlert['severity']) {
  if (severity === 'high') {
    return 'border-[rgba(255,107,107,0.44)] bg-[rgba(255,107,107,0.14)] text-[var(--status-red)]';
  }

  if (severity === 'medium') {
    return 'border-[rgba(255,146,43,0.44)] bg-[rgba(255,146,43,0.14)] text-[var(--status-orange)]';
  }

  return 'border-[rgba(74,158,255,0.42)] bg-[rgba(74,158,255,0.14)] text-[var(--accent-secondary)]';
}

export function CoachDashboardPage() {
  const { teams, selectedTeam, selectedTeamId, setSelectedTeamId } = useCoachTeam();

  const teamCards = useMemo(() => {
    return teams
      .map((team) => {
        const snapshot = mockTeamSnapshots[team.id];

        if (!snapshot) {
          return null;
        }

        const status = getTeamStatus(snapshot);
        const statusBadge = getTeamStatusBadge(status);

        return {
          ...team,
          ...snapshot,
          status,
          statusBadge,
        };
      })
      .filter((team): team is NonNullable<typeof team> => team !== null);
  }, [teams]);

  const teamsNeedingAttention = useMemo(() => {
    return teamCards.filter((team) => team.status !== 'stable');
  }, [teamCards]);

  const todaySummary = useMemo(() => {
    const totalPlayers = teamCards.reduce((sum, team) => sum + team.players, 0);
    const attentionCount = teamsNeedingAttention.length;

    return {
      totalTeams: teamCards.length,
      totalPlayers,
      attentionCount,
    };
  }, [teamCards, teamsNeedingAttention.length]);

  const teamNameById = useMemo(() => {
    return new Map(teams.map((team) => [team.id, team.name]));
  }, [teams]);

  const allTeamsCalendarItems = useMemo(() => {
    const mergedItems: TeamCalendarItem[] = teams.flatMap((team) => {
      const teamData = getTeamCalendarData(team.id);

      return teamData.items.map((item) => ({
        ...item,
        title: `${team.name} - ${item.title}`,
      }));
    });

    mergedItems.sort((first, second) => {
      const firstDateTime = new Date(`${first.date}T${first.startTime}:00`).getTime();
      const secondDateTime = new Date(`${second.date}T${second.startTime}:00`).getTime();
      return firstDateTime - secondDateTime;
    });

    return mergedItems;
  }, [teams]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="glass-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-secondary)]">Coach Dashboard</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Welcome back, Coach.</h1>
            <p className="mt-2 text-sm text-gray-400">
              {todaySummary.attentionCount > 0
                ? `${todaySummary.attentionCount} teams need attention today across readiness, load, and recovery.`
                : 'All teams are stable today with no major warning signals.'}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] px-2.5 py-1 font-medium text-gray-300">
                {todaySummary.totalTeams} teams
              </span>
              <span className="rounded-full border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] px-2.5 py-1 font-medium text-gray-300">
                {todaySummary.totalPlayers} players
              </span>
              <span className="rounded-full border border-[rgba(0,212,170,0.28)] bg-[rgba(0,212,170,0.1)] px-2.5 py-1 font-medium text-[var(--accent-primary)]">
                Selected team: {selectedTeam.name}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Today</p>
            <p className="mt-1 text-sm font-semibold text-white">{format(new Date(), 'EEEE, MMM d')}</p>
          </div>
        </div>
      </header>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">All Teams Summary</h2>
          <Link
            href="/coach/teams"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-secondary)] transition-colors hover:text-white"
          >
            Open teams
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {teamCards.map((team) => (
            <article
              key={team.id}
              className={`glass-card p-4 transition-colors ${
                team.id === selectedTeamId
                  ? 'border-[rgba(0,212,170,0.42)] bg-[rgba(0,212,170,0.08)]'
                  : 'hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(25,33,73,0.72)]'
              }`}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{team.name}</p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wide text-gray-400">{team.code}</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${team.statusBadge.className}`}>
                  {team.statusBadge.label}
                </span>
              </div>

              <dl className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-gray-300">Players</dt>
                  <dd className="font-semibold text-white">{team.players}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-gray-300">Avg readiness</dt>
                  <dd className="font-semibold text-[var(--accent-primary)]">{team.averageReadiness}%</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-gray-300">Avg load</dt>
                  <dd className="font-semibold text-[var(--accent-secondary)]">{team.averageLoad}</dd>
                </div>
              </dl>

              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTeamId(team.id)}
                  className="rounded-lg border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.05)] px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white transition-colors hover:bg-[rgba(255,255,255,0.1)]"
                >
                  {team.id === selectedTeamId ? 'Selected' : 'Select Team'}
                </button>
                <Link
                  href="/coach/overview"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-secondary)] transition-colors hover:text-white"
                >
                  View team
                  <ArrowUpRight size={12} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] xl:items-stretch">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">All Teams Calendar</h2>
              <p className="mt-1 text-xs text-gray-400">
                Coach-wide schedule across all teams with daily and weekly views.
              </p>
            </div>
            <Link
              href="/coach/calendar"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-secondary)] transition-colors hover:text-white"
            >
              Open full calendar
              <ChevronRight size={14} />
            </Link>
          </div>

          <TeamCalendar items={allTeamsCalendarItems} className="min-h-[560px] xl:h-[760px]" />
        </section>

        <section className="glass-card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Recent Alerts</h2>
              <p className="mt-1 text-xs text-gray-400">Coach-wide flags from readiness, load, attendance, and sleep trends.</p>
            </div>
            <ShieldAlert size={16} className="text-[var(--status-red)]" />
          </div>

          <div className="space-y-2.5">
            {mockCoachAlerts.map((alert) => (
              <article
                key={alert.id}
                className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3.5 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{alert.title}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{alert.description}</p>
                    <p className="mt-1 text-[11px] font-medium text-gray-500">{teamNameById.get(alert.teamId) ?? 'Unknown Team'}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getAlertSeverityClass(alert.severity)}`}>
                    {alert.severity}
                  </span>
                </div>
                <div className="mt-2">
                  <Link
                    href={alert.href}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-secondary)] transition-colors hover:text-white"
                  >
                    Open related page
                    <ArrowUpRight size={12} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)] xl:items-start">
        <section className="glass-card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Cross-Team Upcoming Activities</h2>
              <p className="mt-1 text-xs text-gray-400">Games, training, gym, recovery, and tasks across all teams.</p>
            </div>
            <Link
              href="/coach/calendar"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-secondary)] transition-colors hover:text-white"
            >
              Open calendar
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="space-y-2.5">
            {mockUpcomingActivities.map((activity) => (
              <article
                key={activity.id}
                className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3.5 py-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{activity.title}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {teamNameById.get(activity.teamId) ?? 'Unknown Team'} - {format(parseISO(activity.startsAt), 'EEE, MMM d - h:mm a')}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-[rgba(74,158,255,0.35)] bg-[rgba(74,158,255,0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-secondary)]">
                      {activity.type}
                    </span>
                    {activity.status ? (
                      <span className="rounded-full border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-200">
                        {activity.status}
                      </span>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-300">Quick Actions</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="glass-card group flex min-h-[96px] items-center justify-between gap-3 p-4 transition-colors hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(25,33,73,0.72)]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 rounded-lg border border-[rgba(0,212,170,0.24)] bg-[rgba(0,212,170,0.1)] p-2 text-[var(--accent-primary)]">
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{action.label}</p>
                      <p className="mt-1 text-xs text-gray-400">{action.description}</p>
                    </div>
                  </div>
                  <ArrowUpRight
                    size={14}
                    className="shrink-0 text-gray-500 transition-colors group-hover:text-[var(--accent-secondary)]"
                  />
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      <section className="glass-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Continue Where You Left Off</h2>
            <p className="mt-1 text-xs text-gray-400">
              Last selected team: {selectedTeam.name} - Last viewed page: Team Analytics
            </p>
          </div>
          <Link
            href="/coach/analytics"
            className="inline-flex w-fit items-center gap-1 rounded-lg border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[rgba(255,255,255,0.1)]"
          >
            Return to Team Analytics
            <ChevronRight size={14} />
          </Link>
        </div>
      </section>
    </div>
  );
}
