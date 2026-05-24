import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ComparisonMetricDefinition, TeamPlayerComparisonPoint } from '@/components/coach/analytics/types';

interface PlayerComparisonChartProps {
  graphNumber: number;
  metric: ComparisonMetricDefinition;
  players: TeamPlayerComparisonPoint[];
}

function valueFormatter(value: number, key: ComparisonMetricDefinition['key']) {
  if (key === 'acuteTrainingLoad') return `${Math.round(value)}`;
  if (key === 'energy' || key === 'fatigue') return value.toFixed(1);
  return `${Math.round(value)}`;
}

export function PlayerComparisonChart({ graphNumber, metric, players }: PlayerComparisonChartProps) {
  const comparisonData = players.map((player) => ({
    label: player.playerName,
    value: player[metric.key],
  }));
  const teamAverage =
    comparisonData.length > 0
      ? comparisonData.reduce((sum, entry) => sum + entry.value, 0) / comparisonData.length
      : 0;

  return (
    <article className="glass-card relative h-72 p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-300">{metric.label} Comparison</h3>
        <span className="rounded-md border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.06)] px-2 py-0.5 text-xs font-bold text-white">
          {graphNumber}
        </span>
      </div>

      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={comparisonData} margin={{ top: 8, right: 8, left: -20, bottom: 2 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="label" stroke="gray" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis
              stroke="gray"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              domain={metric.domain ?? ['dataMin - 5', 'dataMax + 5']}
            />
            <Tooltip
              formatter={(value) => {
                const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
                return valueFormatter(numericValue, metric.key);
              }}
              contentStyle={{
                backgroundColor: 'rgba(10,14,39,0.94)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: '10px',
              }}
            />
            <ReferenceLine
              y={teamAverage}
              stroke="rgba(255,255,255,0.34)"
              strokeDasharray="4 4"
              label={{
                value: 'Team Avg',
                position: 'insideTopRight',
                fill: '#d1d5db',
                fontSize: 10,
              }}
            />
            <Bar dataKey="value" name={metric.shortLabel} fill={metric.color} fillOpacity={0.7} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
