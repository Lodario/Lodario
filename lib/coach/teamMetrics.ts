import type { TeamPlayerDataset } from '@/components/coach/players/types';

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
