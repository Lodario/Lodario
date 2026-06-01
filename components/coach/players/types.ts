export type PlayerViewMode = 'analytics' | 'calendar';

export type PlayerSessionType = 'training' | 'game' | 'gym' | 'recovery' | 'solo' | 'meeting' | 'other';

export interface CoachPlayer {
  id: string;
  teamId: string;
  name: string;
  jerseyNumber: number;
  positions: string[];
  age: number;
  heightCm: number;
  weightKg: number;
}

export interface PlayerWellnessMetrics {
  readinessScore: number;
  fatigue: number;
  loadScore: number;
}

export interface PlayerCalendarEvent {
  id: string;
  playerId: string;
  teamId: string;
  title: string;
  type: PlayerSessionType;
  date: string;
  startTime: string;
  endTime: string;
}

export interface PlayerNoteItem {
  id: string;
  date: string;
  note: string;
}

export interface PlayerInjuryStatus {
  state: 'healthy' | 'active' | 'recovering' | 'resolved' | 'unavailable';
  description?: string;
  expectedReturn?: string;
  message?: string;
}

export interface PlayerAnalyticsData {
  readinessTrend: Array<{ date: string; label: string; readinessScore: number }>;
  energyFatigueLoad: Array<{
    date: string;
    label: string;
    energy: number;
    fatigue: number;
    acuteTrainingLoad: number;
  }>;
  sleepQualityAndTiming: Array<{
    date: string;
    label: string;
    sleepHours: number;
    sleepQualityScore: number;
    sleepScore: number;
    bedTime: string;
    wakeTime: string;
  }>;
  stressVsSleepScore: Array<{
    date: string;
    label: string;
    stress: number;
    sleepScore: number;
  }>;
  multiFactorReadiness: Array<{
    date: string;
    label: string;
    readinessScore: number;
    sleepScore: number;
    energyScore: number;
    fatigueScore: number;
    stressScore: number;
    loadScore: number;
  }>;
}

export interface TeamPlayerDataset {
  player: CoachPlayer;
  wellness: PlayerWellnessMetrics;
  analytics: PlayerAnalyticsData;
  calendarEvents: PlayerCalendarEvent[];
  wellnessNotes: PlayerNoteItem[];
  trainingNotes: PlayerNoteItem[];
  injuryStatus: PlayerInjuryStatus;
}
