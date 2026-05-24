export type TeamEventType = 'training' | 'game' | 'gym' | 'recovery' | 'solo' | 'meeting' | 'other';

export type TeamCalendarItemKind = 'event' | 'task';

export type TeamCalendarItemStatus = 'upcoming' | 'completed';

export interface TeamCalendarItem {
  id: string;
  teamId: string;
  title: string;
  type: TeamEventType;
  description: string;
  kind: TeamCalendarItemKind;
  status: TeamCalendarItemStatus;
  date: string;
  startTime: string;
  endTime: string;
  startDate?: string;
  endDate?: string;
}

export interface TeamAverageMetric {
  label: string;
  value: string;
}

export interface TeamCalendarDataset {
  averages: TeamAverageMetric[];
  items: TeamCalendarItem[];
}
