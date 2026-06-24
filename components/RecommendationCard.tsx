import React from 'react';
import { RecommendationResult } from '../lib/recommendations';
import type { PlayerDailyContext } from '../lib/player-context';
import { Target, Activity, Zap, Shield } from 'lucide-react';

interface RecommendationCardProps {
  recommendation: RecommendationResult;
  playerContext?: PlayerDailyContext;
}

function formatLimitingFactor(factor: string): string {
  if (factor === 'Sleep') return 'Sleep affected readiness';
  return factor;
}

function buildGuidanceDetail(
  recommendation: RecommendationResult,
  context: PlayerDailyContext | undefined
): string | null {
  if (!context) return null;

  const todayWellness = context.wellness.todayLog;
  const { readinessLoad, wellness, training, painInjury, missedLogs } = context;

  if (painInjury.hasPainToday || painInjury.hasActiveOrRecoveringInjury || painInjury.hasAutoInjury) {
    return 'Pain or injury signals are present, so keep football work modified and avoid extra intensity.';
  }

  if (wellness.loggedDays < 3) {
    return `Only ${wellness.loggedDays} recent wellness check-in${wellness.loggedDays === 1 ? '' : 's'} logged, so use this as a cautious guide while the picture builds.`;
  }

  if (!readinessLoad.load.hasAcuteData && training.sessions === 0) {
    return 'Recent training load is limited, so base today on controlled ball work and how you feel during the warm-up.';
  }

  if ((todayWellness?.sleepDuration ?? 10) < 6 || readinessLoad.readiness.breakdown.sleep < 55) {
    return 'Sleep is the main limiter today; keep the session sharp, technical, and avoid piling on extra running.';
  }

  if ((todayWellness?.fatigue ?? 0) >= 7 || readinessLoad.readiness.breakdown.fatigue < 45) {
    return 'Fatigue is the main limiter today; prioritize quality touches and keep repeat sprints controlled.';
  }

  if ((todayWellness?.stress ?? 0) >= 7 || readinessLoad.readiness.breakdown.stress < 45) {
    return 'Stress is elevated today; keep the work simple, focused, and easy to adjust after the warm-up.';
  }

  if (readinessLoad.loadRisk === 'spike') {
    return 'Recent load has spiked, so avoid adding extra high-speed work on top of planned football.';
  }

  if (readinessLoad.loadRisk === 'elevated') {
    return 'Recent load is elevated; make today purposeful and leave some reserve for the next session.';
  }

  if (missedLogs.recentWellnessMissedDays >= 3) {
    return 'A few recent wellness check-ins are missing, so keep logging daily to make guidance more reliable.';
  }

  if (recommendation.recommendationLabel === 'Intense') {
    return "Wellness and load look clear enough for purposeful intensity if it fits today's football plan.";
  }

  if (recommendation.recommendationLabel === 'Moderate') {
    return 'Signals look balanced; keep the session controlled and build intensity only if the warm-up feels good.';
  }

  return null;
}

export function RecommendationCard({ recommendation, playerContext }: RecommendationCardProps) {
  const guidanceDetail = buildGuidanceDetail(recommendation, playerContext);

  const getGradient = () => {
    switch (recommendation.recommendationLabel) {
      case 'Intense': return 'from-[var(--status-green)] to-[var(--accent-tertiary)]';
      case 'Moderate': return 'from-[var(--status-yellow)] to-amber-500';
      case 'Light': return 'from-[var(--status-orange)] to-orange-600';
      case 'Recovery': return 'from-[var(--status-red)] to-rose-600';
      default: return 'from-gray-600 to-gray-800';
    }
  };

  const getIcon = () => {
    switch (recommendation.recommendationLabel) {
      case 'Intense': return <Zap className="text-white opacity-80" />;
      case 'Moderate': return <Activity className="text-white opacity-80" />;
      case 'Light': return <Target className="text-white opacity-80" />;
      case 'Recovery': return <Shield className="text-white opacity-80" />;
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
            {recommendation.recommendationLabel} Recommendation
          </h3>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-2.5 py-2">
            <span className="block text-[10px] uppercase tracking-wider text-gray-400">Readiness</span>
            <span className="mt-0.5 block font-semibold text-white">{recommendation.score} - {recommendation.readinessZoneLabel}</span>
          </div>
          <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-2.5 py-2">
            <span className="block text-[10px] uppercase tracking-wider text-gray-400">Load Risk</span>
            <span className="mt-0.5 block font-semibold text-white">{recommendation.loadRiskLabel}</span>
          </div>
        </div>

        <p className={`text-sm text-gray-300 leading-relaxed ${guidanceDetail ? 'mb-2' : 'mb-4'}`}>
          {recommendation.reason}
        </p>

        {guidanceDetail ? (
          <p className="mb-4 text-xs leading-relaxed text-gray-400">
            {guidanceDetail}
          </p>
        ) : null}

        {recommendation.limitingFactors.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {recommendation.limitingFactors.map((factor) => (
              <span key={factor} className="text-xs px-2 py-1 rounded-md bg-[rgba(255,255,255,0.08)] text-gray-200 border border-[rgba(255,255,255,0.08)]">
                {formatLimitingFactor(factor)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
