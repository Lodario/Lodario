import type { PlayerWellnessMetrics } from '@/components/coach/players/types';

interface WellnessMetricsPanelProps {
  metrics: PlayerWellnessMetrics;
}

interface MetricRow {
  label: string;
  value: number;
  colorClass: string;
}

export function WellnessMetricsPanel({ metrics }: WellnessMetricsPanelProps) {
  const metricRows: MetricRow[] = [
    { label: 'Readiness Score', value: metrics.readinessScore, colorClass: 'bg-[var(--metric-readiness)]' },
    { label: 'Fatigue', value: metrics.fatigue, colorClass: 'bg-[var(--metric-fatigue)]' },
    { label: 'Load Score', value: metrics.loadScore, colorClass: 'bg-[var(--metric-load-score)]' },
  ];

  return (
    <section className="glass-card p-4 sm:p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-300">Wellness Snapshot</h3>
      <div className="mt-4 space-y-4">
        {metricRows.map((metric) => (
          <div key={metric.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <p className="text-sm text-gray-200">{metric.label}</p>
              <span className="rounded-md border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.06)] px-2 py-0.5 text-xs font-semibold text-white">
                {metric.value}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)]">
              <div
                className={`h-full rounded-full ${metric.colorClass}`}
                style={{ width: `${Math.min(100, Math.max(0, metric.value))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
