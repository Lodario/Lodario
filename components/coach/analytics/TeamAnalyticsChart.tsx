import { PlayerAnalyticsChart } from '@/components/coach/players/PlayerAnalyticsChart';

interface TeamAnalyticsSeries {
  dataKey: string;
  name: string;
  color: string;
  type?: 'line' | 'bar';
  yAxisId?: 'left' | 'right';
}

interface TeamAnalyticsChartProps {
  graphNumber: number;
  title: string;
  data: Array<Record<string, string | number>>;
  series: TeamAnalyticsSeries[];
  leftDomain?: [number, number];
  rightDomain?: [number, number];
  footerNote?: string;
}

export function TeamAnalyticsChart(props: TeamAnalyticsChartProps) {
  return <PlayerAnalyticsChart {...props} />;
}
