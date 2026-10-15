'use client';

import React from 'react';
import { RecommendationResult } from '../lib/recommendations';
import type { PlayerDailyContext } from '../lib/player-context';
import { Target, Activity, Zap, Shield, ChevronDown } from 'lucide-react';

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
    return 'Pain or injury signals are present, so reduce football intensity and avoid adding extra high-intensity work.';
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
  const [showMetrics, setShowMetrics] = React.useState(false);
  const metricsId = React.useId();

  const getColor = () => {
    switch (recommendation.recommendationLabel) {
      case 'Intense': return '#16c76a';
      case 'Moderate': return '#b6db36';
      case 'Light': return '#f4ad25';
      case 'Recovery': return recommendation.recoveryCause === 'injury' ? '#ef4444' : '#ff4b23';
    }
  };

  const getIcon = () => {
    switch (recommendation.recommendationLabel) {
      case 'Intense': return <Zap size={22} aria-hidden="true" />;
      case 'Moderate': return <Activity size={22} aria-hidden="true" />;
      case 'Light': return <Target size={22} aria-hidden="true" />;
      case 'Recovery': return <Shield size={22} aria-hidden="true" />;
    }
  };

  return (
    <div
      className="mt-6 rounded-2xl border border-[var(--recommendation-color)] bg-[var(--surface-card)] p-5 shadow-lg animate-slide-up"
      style={{ '--recommendation-color': getColor() } as React.CSSProperties}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-white">Recommendation</h3>
        <button
          type="button"
          aria-label={showMetrics ? 'Hide readiness and load risk' : 'Show readiness and load risk'}
          aria-expanded={showMetrics}
          aria-controls={metricsId}
          onClick={() => setShowMetrics((visible) => !visible)}
          className="touch-target -mr-2 flex shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--recommendation-color)]"
        >
          <ChevronDown size={18} aria-hidden="true" className={`transition-transform motion-reduce:transition-none ${showMetrics ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div id={metricsId} hidden={!showMetrics} className="mb-4 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs text-gray-300">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span>Readiness <strong className="font-semibold text-white">{recommendation.score} – {recommendation.readinessZoneLabel}</strong></span>
          <span aria-hidden="true" className="text-gray-600">│</span>
          <span>Load Risk – <strong className="font-semibold text-white">{recommendation.loadRiskLabel}</strong></span>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2.5 text-[var(--recommendation-color)]">
        {getIcon()}
        <span className="text-xl font-bold">{recommendation.recommendationLabel}</span>
      </div>

      <p className="text-sm text-gray-300 leading-relaxed">
        {recommendation.reason}
      </p>

      {guidanceDetail ? (
        <p className="mt-2 text-xs leading-relaxed text-gray-400">
          {guidanceDetail}
        </p>
      ) : null}

      {recommendation.limitingFactors.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-gray-400">Limiting factors</p>
          <div className="flex flex-wrap gap-2">
            {recommendation.limitingFactors.map((factor) => (
              <span key={factor} className="text-xs px-2 py-1 rounded-md bg-[rgba(255,255,255,0.08)] text-gray-200 border border-[rgba(255,255,255,0.08)]">
                {formatLimitingFactor(factor)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
