'use client';

import { useMemo } from 'react';
import { EventCreatorPanel } from '@/components/coach/calendar/EventCreatorPanel';
import { getTeamCalendarData } from '@/components/coach/calendar/mockData';
import { TeamAveragesPanel } from '@/components/coach/calendar/TeamAveragesPanel';
import { TeamCalendar } from '@/components/coach/calendar/TeamCalendar';
import { useCoachTeam } from '@/lib/coach/selectedTeam';

export function CoachCalendarPage() {
  const { selectedTeam } = useCoachTeam();
  const teamData = useMemo(() => getTeamCalendarData(selectedTeam.id), [selectedTeam.id]);
  const desktopCardHeightClass = 'xl:h-[760px]';

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-white">Calendar</h1>
        <p className="mt-2 text-sm text-gray-400">Manage events, tasks, and schedule windows for {selectedTeam.name}.</p>
        <p className="mt-3 text-xs font-medium text-[var(--accent-secondary)]">Selected team: {selectedTeam.name}</p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)_340px] xl:items-stretch">
        <TeamAveragesPanel metrics={teamData.averages} className={desktopCardHeightClass} />
        <TeamCalendar items={teamData.items} className={desktopCardHeightClass} />
        <EventCreatorPanel teamName={selectedTeam.name} className={desktopCardHeightClass} />
      </div>
    </div>
  );
}
