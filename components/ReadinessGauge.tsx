import React from 'react';

interface ReadinessGaugeProps {
  score: number;
  color: string;
  label: string;
}

export function ReadinessGauge({ score, color, label }: ReadinessGaugeProps) {
  const radius = 80;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-6 glass-card relative animate-fade-in touch-target">
      <div className="relative flex items-center justify-center">
        {/* Background Circle */}
        <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
          <circle
            stroke="rgba(255,255,255,0.1)"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          {/* Progress Circle */}
          <circle
            stroke={color}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset, transition: 'stroke-dashoffset 1s ease-out' }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-4xl font-bold" style={{ color }}>
            {score}
          </span>
          <span className="text-xs text-gray-400 capitalize">{label}</span>
        </div>
      </div>
      <div className="mt-4 text-center">
        <h3 className="text-lg font-semibold text-white tracking-wide">Daily Readiness</h3>
      </div>
    </div>
  );
}
