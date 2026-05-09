import React from 'react';
import { RecommendationResult } from '../lib/recommendations';
import { Target, Activity, Zap } from 'lucide-react';

interface RecommendationCardProps {
  recommendation: RecommendationResult;
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const getGradient = () => {
    switch (recommendation.intensity) {
      case 'Intense': return 'from-[var(--status-green)] to-emerald-600';
      case 'Moderate': return 'from-[var(--status-yellow)] to-amber-500';
      case 'Light': return 'from-[var(--status-orange)] to-orange-600';
      case 'Recovery': return 'from-[var(--status-red)] to-rose-600';
      default: return 'from-gray-600 to-gray-800';
    }
  };

  const getIcon = () => {
    switch (recommendation.intensity) {
      case 'Intense': return <Zap className="text-white opacity-80" />;
      case 'Moderate': return <Activity className="text-white opacity-80" />;
      case 'Light': return <Target className="text-white opacity-80" />;
      case 'Recovery': return <span className="text-xl">🛡️</span>;
      default: return <Activity className="text-white opacity-80" />;
    }
  };

  return (
    <div className={`mt-6 rounded-2xl p-[1px] bg-gradient-to-r ${getGradient()} shadow-lg animate-slide-up touch-target`}>
      <div className="bg-[var(--background)] h-full w-full rounded-2xl p-5 flex flex-col justify-between" style={{ background: 'linear-gradient(to bottom right, rgba(10, 14, 39, 0.9), rgba(10, 14, 39, 0.95))' }}>
        <div className="flex items-center space-x-3 mb-3">
          <div className={`p-2 rounded-lg bg-gradient-to-br ${getGradient()}`}>
            {getIcon()}
          </div>
          <h3 className="text-lg font-bold text-white tracking-wide">
            {recommendation.intensity} Session
          </h3>
        </div>
        
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
          {recommendation.message}
        </p>

        {recommendation.focusAreas.length > 0 && (
          <div className="mt-2">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Suggested Focus</h4>
            <div className="flex flex-wrap gap-2">
              {recommendation.focusAreas.map((area, idx) => (
                <span key={idx} className="text-xs px-2 py-1 rounded-md bg-[rgba(255,255,255,0.1)] text-white border border-[rgba(255,255,255,0.05)]">
                  {area}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
