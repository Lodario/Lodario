import { BatteryMedium, Brain, CirclePlus, Dumbbell, Moon, Zap } from 'lucide-react';

interface HomeReadinessProps {
  score: number;
  label: string;
  breakdown: { stress: number; energy: number; sleep: number; fatigue: number; load: number };
  painScore: number;
}

const clamp = (score: number) => Math.max(0, Math.min(100, score));

function arc(radius: number, start: number, end: number) {
  const point = (angle: number) => {
    const radians = angle * Math.PI / 180;
    return `${200 + radius * Math.cos(radians)} ${80 + radius * Math.sin(radians)}`;
  };
  return `M ${point(start)} A ${radius} ${radius} 0 0 1 ${point(end)}`;
}

export function HomeReadiness({ score, label, breakdown, painScore }: HomeReadinessProps) {
  const metrics = [
    { label: 'Stress', score: breakdown.stress, color: '#ae58ff', radius: 137, left: true, Icon: Brain },
    { label: 'Energy', score: breakdown.energy, color: '#ffd43b', radius: 114, left: true, Icon: Zap },
    { label: 'Sleep', score: breakdown.sleep, color: '#00bdf4', radius: 91, left: true, Icon: Moon },
    { label: 'Fatigue', score: breakdown.fatigue, color: '#ff4249', radius: 91, left: false, Icon: BatteryMedium },
    { label: 'Load', score: breakdown.load, color: '#ff873e', radius: 114, left: false, Icon: Dumbbell },
    { label: 'Pain', score: painScore, progress: 100 - painScore, color: '#00d889', radius: 137, left: false, Icon: CirclePlus },
  ];
  const circumference = 2 * Math.PI * 58;

  return (
    <svg viewBox="0 0 400 180" className="home-readiness" role="img" aria-label={`Daily readiness: ${score} out of 100, ${label}. ${metrics.map(metric => `${metric.label}: ${Math.round(metric.score)}`).join('. ')}`}>
      <circle cx="200" cy="80" r="58" fill="none" stroke="#293130" strokeWidth="12" />
      <circle cx="200" cy="80" r="58" fill="none" stroke="#00d889" strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - clamp(score) / 100)} transform="rotate(-90 200 80)" className="home-readiness-progress" />
      <text x="200" y="97" textAnchor="middle" fill="#00d889" fontSize="44" fontWeight="800">{score}</text>
      {metrics.map(({ label: metricLabel, score: metricScore, progress = metricScore, color, radius, left, Icon }) => {
        const angle = Math.asin(54 / radius) * 180 / Math.PI;
        const path = arc(radius, left ? 180 - angle : -angle, left ? 180 + angle : angle);
        const iconX = 200 + (left ? -1 : 1) * Math.sqrt(radius * radius - 54 * 54);
        return (
          <g key={metricLabel}>
            <title>{metricLabel}: {Math.round(metricScore)} out of 100</title>
            <path d={path} fill="none" stroke={color} strokeOpacity="0.32" strokeWidth="14" strokeLinecap="round" />
            <path d={path} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" pathLength="100" strokeDasharray={`${clamp(progress)} 100`} transform={left ? undefined : 'translate(0 160) scale(1 -1)'} className="home-readiness-progress" />
            <Icon x={iconX - 9} y="148" width="18" height="18" color={color} strokeWidth={2.4} fill={metricLabel === 'Energy' || metricLabel === 'Sleep' ? color : 'none'} />
          </g>
        );
      })}
    </svg>
  );
}
