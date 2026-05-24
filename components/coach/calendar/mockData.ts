import { addDays } from 'date-fns';
import type { TeamCalendarDataset, TeamCalendarItem } from '@/components/coach/calendar/types';

function atDay(referenceDate: Date, dayOffset: number) {
  return addDays(referenceDate, dayOffset).toISOString().slice(0, 10);
}

function buildCalendarItems(teamId: string, dayShift: number): TeamCalendarItem[] {
  const referenceDate = new Date('2026-05-18T00:00:00');
  const makeDay = (dayOffset: number) => atDay(referenceDate, dayOffset + dayShift);

  return [
    {
      id: `${teamId}-event-1`,
      teamId,
      title: 'Team Training Block',
      type: 'training',
      description: 'Tactical rondos, pressing triggers, and shape work.',
      kind: 'event',
      status: 'upcoming',
      date: makeDay(0),
      startTime: '09:00',
      endTime: '10:30',
    },
    {
      id: `${teamId}-event-2`,
      teamId,
      title: 'Video Review',
      type: 'meeting',
      description: 'Review weekend clips and role-specific actions.',
      kind: 'event',
      status: 'upcoming',
      date: makeDay(1),
      startTime: '12:00',
      endTime: '12:45',
    },
    {
      id: `${teamId}-event-3`,
      teamId,
      title: 'Lower Body Gym',
      type: 'gym',
      description: 'Power and posterior chain focus.',
      kind: 'event',
      status: 'upcoming',
      date: makeDay(1),
      startTime: '16:30',
      endTime: '17:45',
    },
    {
      id: `${teamId}-event-4`,
      teamId,
      title: 'Match Day',
      type: 'game',
      description: 'League fixture with full matchday protocol.',
      kind: 'event',
      status: 'upcoming',
      date: makeDay(3),
      startTime: '18:00',
      endTime: '20:00',
    },
    {
      id: `${teamId}-event-5`,
      teamId,
      title: 'Recovery Session',
      type: 'recovery',
      description: 'Mobility circuits, flush bike, and breathing.',
      kind: 'event',
      status: 'completed',
      date: makeDay(-1),
      startTime: '08:00',
      endTime: '09:00',
    },
    {
      id: `${teamId}-task-1`,
      teamId,
      title: 'Solo Touches Task',
      type: 'solo',
      description: 'Complete 45-minute touch volume and submit notes.',
      kind: 'task',
      status: 'upcoming',
      date: makeDay(2),
      startTime: '07:00',
      endTime: '21:00',
      startDate: makeDay(2),
      endDate: makeDay(3),
    },
    {
      id: `${teamId}-task-2`,
      teamId,
      title: 'Hydration & Sleep Check',
      type: 'other',
      description: 'Log hydration and sleep quality before team briefing.',
      kind: 'task',
      status: 'upcoming',
      date: makeDay(4),
      startTime: '06:00',
      endTime: '22:00',
      startDate: makeDay(4),
      endDate: makeDay(5),
    },
  ];
}

const datasets: Record<string, TeamCalendarDataset> = {
  'whitby-u19': {
    averages: [
      { label: 'Team Readiness Score', value: '84' },
      { label: 'Team Fatigue', value: '73' },
      { label: 'Team Energy', value: '78' },
      { label: 'Team Stress', value: '46' },
      { label: 'Team Sleep Score', value: '86' },
      { label: 'Team Sleep Quantity', value: '7.8 h' },
      { label: 'Team Sleep Quality', value: '84' },
      { label: 'Acute Training Load', value: '668' },
      { label: 'Load Score', value: '82' },
      { label: 'Average Sleep Time', value: '22:43' },
      { label: 'Average Wake Time', value: '06:56' },
    ],
    items: buildCalendarItems('whitby-u19', 0),
  },
  'whitby-u17': {
    averages: [
      { label: 'Team Readiness Score', value: '80' },
      { label: 'Team Fatigue', value: '76' },
      { label: 'Team Energy', value: '74' },
      { label: 'Team Stress', value: '52' },
      { label: 'Team Sleep Score', value: '79' },
      { label: 'Team Sleep Quantity', value: '7.4 h' },
      { label: 'Team Sleep Quality', value: '77' },
      { label: 'Acute Training Load', value: '596' },
      { label: 'Load Score', value: '77' },
      { label: 'Average Sleep Time', value: '22:58' },
      { label: 'Average Wake Time', value: '07:02' },
    ],
    items: buildCalendarItems('whitby-u17', 1),
  },
  'seattle-u23': {
    averages: [
      { label: 'Team Readiness Score', value: '85' },
      { label: 'Team Fatigue', value: '69' },
      { label: 'Team Energy', value: '81' },
      { label: 'Team Stress', value: '43' },
      { label: 'Team Sleep Score', value: '88' },
      { label: 'Team Sleep Quantity', value: '8.0 h' },
      { label: 'Team Sleep Quality', value: '86' },
      { label: 'Acute Training Load', value: '684' },
      { label: 'Load Score', value: '86' },
      { label: 'Average Sleep Time', value: '22:29' },
      { label: 'Average Wake Time', value: '06:44' },
    ],
    items: buildCalendarItems('seattle-u23', 0),
  },
  'ridgeview-w': {
    averages: [
      { label: 'Team Readiness Score', value: '87' },
      { label: 'Team Fatigue', value: '67' },
      { label: 'Team Energy', value: '83' },
      { label: 'Team Stress', value: '41' },
      { label: 'Team Sleep Score', value: '89' },
      { label: 'Team Sleep Quantity', value: '8.1 h' },
      { label: 'Team Sleep Quality', value: '87' },
      { label: 'Acute Training Load', value: '642' },
      { label: 'Load Score', value: '84' },
      { label: 'Average Sleep Time', value: '22:25' },
      { label: 'Average Wake Time', value: '06:41' },
    ],
    items: buildCalendarItems('ridgeview-w', 2),
  },
};

const fallbackTeamId = 'whitby-u19';

export function getTeamCalendarData(teamId: string): TeamCalendarDataset {
  return datasets[teamId] ?? datasets[fallbackTeamId];
}
