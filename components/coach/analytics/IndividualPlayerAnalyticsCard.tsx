import type { TeamPlayerComparisonPoint } from '@/components/coach/analytics/types';

interface IndividualPlayerAnalyticsCardProps {
  player: TeamPlayerComparisonPoint;
  teamAverageLoad: number;
}

function getStatus(player: TeamPlayerComparisonPoint, teamAverageLoad: number) {
  const overloaded = player.acuteTrainingLoad > teamAverageLoad * 1.08 || player.loadRiskLabel === 'Elevated' || player.loadRiskLabel === 'Spike';
  const underRecovered = player.readinessScore < 70 || player.sleepScore < 70 || player.fatigue >= 7;

  if (overloaded || underRecovered) {
    return { label: 'Needs Attention', className: 'text-[var(--status-red)] border-[rgba(255,107,107,0.4)] bg-[rgba(255,107,107,0.12)]' };
  }

  return { label: 'Stable', className: 'text-[var(--status-green)] border-[rgba(var(--status-green-rgb),0.4)] bg-[rgba(var(--status-green-rgb),0.12)]' };
}

export function IndividualPlayerAnalyticsCard({
  player,
  teamAverageLoad,
}: IndividualPlayerAnalyticsCardProps) {
  const status = getStatus(player, teamAverageLoad);

  return (
    <article className="glass-card p-3 sm:p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate pr-2 text-sm font-semibold text-white">{player.playerName}</h3>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Readiness</p>
          <p className="mt-0.5 text-xs font-semibold text-white">{player.readinessScore}</p>
        </div>
        <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Sleep</p>
          <p className="mt-0.5 text-xs font-semibold text-white">{player.sleepScore}</p>
        </div>
        <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Fatigue</p>
          <p className="mt-0.5 text-xs font-semibold text-white">{player.fatigue.toFixed(1)}</p>
        </div>
        <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Load Score</p>
          <p className="mt-0.5 text-xs font-semibold text-white">{player.loadScore}</p>
        </div>
        <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Energy</p>
          <p className="mt-0.5 text-xs font-semibold text-white">{player.energy.toFixed(1)}</p>
        </div>
        <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Stress</p>
          <p className="mt-0.5 text-xs font-semibold text-white">{player.stress}</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400">
        <span>Acute load {Math.round(player.acuteTrainingLoad)}</span>
        {player.loadRiskLabel ? <span>Load risk {player.loadRiskLabel}</span> : null}
        {player.recommendationLabel ? <span>Recommendation {player.recommendationLabel}</span> : null}
      </div>
    </article>
  );
}
