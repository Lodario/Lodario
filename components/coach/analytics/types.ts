import type { TeamAverageMetric } from '@/components/coach/calendar/types';

export type AnalyticsViewMode = 'averages' | 'individuals';

export interface TeamReadinessTrendPoint {
  [key: string]: string | number;
  label: string;
  readinessScore: number;
}

export interface TeamEnergyFatigueLoadPoint {
  [key: string]: string | number;
  label: string;
  energy: number;
  fatigue: number;
  acuteTrainingLoad: number;
}

export interface TeamSleepQualityAndTimingPoint {
  [key: string]: string | number;
  label: string;
  sleepHours: number;
  sleepQualityScore: number;
  sleepScore: number;
  bedTime: string;
  wakeTime: string;
}

export interface TeamStressVsSleepScorePoint {
  [key: string]: string | number;
  label: string;
  stress: number;
  sleepScore: number;
}

export interface TeamMultiFactorReadinessPoint {
  [key: string]: string | number;
  label: string;
  readinessScore: number;
  sleepScore: number;
  energyScore: number;
  fatigueScore: number;
  stressScore: number;
  loadScore: number;
}

export interface TeamAveragesAnalyticsData {
  readinessTrend: TeamReadinessTrendPoint[];
  energyFatigueLoad: TeamEnergyFatigueLoadPoint[];
  sleepQualityAndTiming: TeamSleepQualityAndTimingPoint[];
  stressVsSleepScore: TeamStressVsSleepScorePoint[];
  multiFactorReadiness: TeamMultiFactorReadinessPoint[];
}

export type ComparisonMetricKey =
  | 'readinessScore'
  | 'fatigue'
  | 'energy'
  | 'stress'
  | 'sleepScore'
  | 'acuteTrainingLoad'
  | 'loadScore';

export interface TeamPlayerComparisonPoint {
  playerId: string;
  playerName: string;
  label: string;
  readinessScore: number;
  fatigue: number;
  energy: number;
  stress: number;
  sleepScore: number;
  acuteTrainingLoad: number;
  loadScore: number;
}

export interface ComparisonMetricDefinition {
  key: ComparisonMetricKey;
  label: string;
  shortLabel: string;
  color: string;
  goodDirection: 'higher' | 'lower';
  domain?: [number, number];
}

export interface TeamAnalyticsDataset {
  teamId: string;
  labels: string[];
  averages: TeamAveragesAnalyticsData;
  teamAveragesMetrics: TeamAverageMetric[];
  legendItems: string[];
  individualsByLabel: Record<string, TeamPlayerComparisonPoint[]>;
}
