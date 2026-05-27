import type { TeamCalendarDataset } from '@/components/coach/calendar/types';

const emptyTeamCalendarDataset: TeamCalendarDataset = {
  averages: [],
  items: [],
};

export function getTeamCalendarData(_teamId: string): TeamCalendarDataset {
  return emptyTeamCalendarDataset;
}
