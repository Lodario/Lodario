import type { TeamPlayerDataset } from '@/components/coach/players/types';

function toFiniteNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function getPlayerReadinessForDate(
  dataset: TeamPlayerDataset,
  dateKey: string
): number | null {
  const point = dataset.analytics.readinessTrend.find((item) => item.date === dateKey);
  return point && Number.isFinite(point.readinessScore) ? point.readinessScore : null;
}

export function getTeamReadinessForDate(
  players: TeamPlayerDataset[],
  dateKey: string
): { average: number | null; reportingPlayers: number; scores: number[] } {
  const scores = players
    .map((dataset) => getPlayerReadinessForDate(dataset, dateKey))
    .filter((score): score is number => score !== null);

  return {
    average: scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : null,
    reportingPlayers: scores.length,
    scores,
  };
}

export function getTeamTrainingAverage(
  players: TeamPlayerDataset[],
  getValue: (dataset: TeamPlayerDataset) => number | null | undefined
): number | null {
  if (players.length === 0) return null;

  const total = players.reduce((sum, dataset) => sum + toFiniteNumber(getValue(dataset)), 0);
  return total / players.length;
}

export function getPlayerTrainingLoadForDate(
  dataset: TeamPlayerDataset,
  dateKey: string
): number {
  const point = dataset.analytics.energyFatigueLoad.find((item) => item.date === dateKey);
  return toFiniteNumber(point?.acuteTrainingLoad);
}

export function hasPlayerTrainingLogForDate(
  dataset: TeamPlayerDataset,
  dateKey: string
): boolean {
  return getPlayerTrainingLoadForDate(dataset, dateKey) > 0;
}

export function getTeamTrainingLoadForDate(
  players: TeamPlayerDataset[],
  dateKey: string
): number | null {
  return getTeamTrainingAverage(players, (dataset) => getPlayerTrainingLoadForDate(dataset, dateKey));
}

export function getTeamTrainingAverageForDate(
  players: TeamPlayerDataset[],
  dateKey: string,
  getValue: (dataset: TeamPlayerDataset, dateKey: string) => number | null | undefined
): number | null {
  if (players.length === 0) return null;

  const total = players.reduce((sum, dataset) => {
    return sum + (hasPlayerTrainingLogForDate(dataset, dateKey) ? toFiniteNumber(getValue(dataset, dateKey)) : 0);
  }, 0);

  return total / players.length;
}
