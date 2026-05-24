import type { TeamAverageMetric } from '@/components/coach/calendar/types';

interface TeamAveragesPanelProps {
  metrics: TeamAverageMetric[];
  graphNumber?: number;
  className?: string;
}

export function TeamAveragesPanel({ metrics, graphNumber = 6, className }: TeamAveragesPanelProps) {
  return (
    <section className={`glass-card relative p-4 sm:p-5 ${className ?? ''}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-300">Team Averages</h3>
        <span className="rounded-md border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] px-2 py-0.5 text-xs font-bold text-white">
          {graphNumber}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-flow-col xl:grid-rows-3 xl:auto-cols-fr">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-2.5 py-2"
          >
            <p className="text-[10px] uppercase tracking-wide text-gray-400">{metric.label}</p>
            <p className="mt-0.5 text-xs font-semibold text-white">{metric.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
