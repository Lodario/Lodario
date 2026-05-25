import type { TeamAverageMetric } from '@/components/coach/calendar/types';

interface TeamAveragesPanelProps {
  metrics: TeamAverageMetric[];
  className?: string;
}

export function TeamAveragesPanel({ metrics, className }: TeamAveragesPanelProps) {
  return (
    <section className={`glass-card flex min-h-0 flex-col p-4 sm:p-5 ${className ?? ''}`}>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-300">Team Averages</h2>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-3 py-2.5"
          >
            <p className="text-[11px] uppercase tracking-wide text-gray-400">{metric.label}</p>
            <p className="mt-1 text-sm font-semibold text-white">{metric.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
