import type { TeamAverageMetric } from '@/components/coach/calendar/types';

interface TeamAveragesPanelProps {
  metrics: TeamAverageMetric[];
  className?: string;
}

export function TeamAveragesPanel({ metrics, className }: TeamAveragesPanelProps) {
  return (
    <section className={`glass-card flex min-h-0 flex-col p-4 sm:p-5 ${className ?? ''}`}>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-300">Team Averages</h2>
      {metrics.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">
          No team averages yet. Wellness averages appear when players check in; load averages appear once sessions are logged.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {metrics.map((metric) => (
            <article
              key={metric.label}
              className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-3 py-2.5"
            >
              <p
                className="text-[11px] uppercase tracking-wide text-gray-400"
                title={metric.label === 'Average Load' ? 'Total seven-day training load divided by all players on the team.' : undefined}
              >
                {metric.label === 'Average Load' ? 'Average Load (7 days)' : metric.label}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{metric.value}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
