import { TrainingLog, WellnessLog } from './types';
import { differenceInDays, parseISO, subDays } from 'date-fns';

export interface LoadResult {
  acuteLoad: number;
  chronicLoad: number;
  acuteChronicRatio: number;
  isSpike: boolean;
  sustainedFatigue: boolean;
  isLowWorkload: boolean;
  hasAutoInjury: boolean;
  hasAcuteData: boolean;   // true when there are sessions in the last 7 days
  hasChronicData: boolean; // true when there are sessions spanning enough of the 28-day window
}

export function analyzeTrainingLoad(
  trainingLogs: TrainingLog[],
  wellnessLogs: WellnessLog[]
): LoadResult {
  const today = new Date();

  let acuteLoad = 0; // last 7 days
  let chronicLoad = 0; // last 28 days

  let numSessionsLast7 = 0;
  let numSessionsLast14 = 0;
  let oldestDaysAgoInWindow = 0;

  trainingLogs.forEach((log) => {
    const daysAgo = differenceInDays(today, parseISO(log.date));
    const load = log.duration * log.intensity;

    if (daysAgo <= 7) {
      acuteLoad += load;
      numSessionsLast7++;
    }
    if (daysAgo <= 14) {
      numSessionsLast14++;
    }
    if (daysAgo <= 28) {
      chronicLoad += load;
      if (daysAgo > oldestDaysAgoInWindow) {
        oldestDaysAgoInWindow = daysAgo;
      }
    }
  });

  // Calculate ratio
  // Chronic load is expressed as a weekly average, divided by the actual
  // number of weeks of data available (capped between 1 and 4) so that
  // new users with less than 28 days of logs aren't falsely flagged as spiking.
  const activeWeeks = Math.max(1, Math.min(4, (oldestDaysAgoInWindow + 1) / 7));
  const chronicWeeklyAvg = chronicLoad / activeWeeks;
  const ratio = chronicWeeklyAvg > 0 ? acuteLoad / chronicWeeklyAvg : 1.0;

  const isSpike = ratio > 1.5;

  // Low Workload: < 3.5 sessions/week for 2+ weeks (numSessionsLast14 < 7)
  const isLowWorkload = numSessionsLast14 < 7;

  // Sustained fatigue: avg fatigue > 7 for 3+ days
  const recentWellness = wellnessLogs
    .filter((l) => differenceInDays(today, parseISO(l.date)) <= 3)
    .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());

  let sustainedFatigue = false;
  if (recentWellness.length >= 3) {
    const avgFatigue = (recentWellness[0].fatigue + recentWellness[1].fatigue + recentWellness[2].fatigue) / 3;
    if (avgFatigue > 7) {
      sustainedFatigue = true;
    }
  }

  // Pain-to-injury auto-detection: painLevel > 3.5 for > 1.5 days -> auto-injury
  // clear when painLevel < 2.5 for 2+ consecutive days
  let hasAutoInjury = false;

  // We look at the last few days in sequence
  // For simplicity, if the last 2 wellness logs both report painActive and painLevel > 3.5, it's flagged.
  // It unflags if the last 2 logs report painLevel < 2.5
  if (recentWellness.length >= 2) {
    const day1 = recentWellness[0];
    const day2 = recentWellness[1];

    if (day1.painActive && day2.painActive && (day1.painLevel || 0) > 3.5 && (day2.painLevel || 0) > 3.5) {
      hasAutoInjury = true;
    } else if ((day1.painLevel || 0) < 2.5 && (day2.painLevel || 0) < 2.5) {
      hasAutoInjury = false;
    }
  }

  // Determine data availability for progressive load integration
  // Acute data: at least 1 session in the last 7 days
  const hasAcuteData = numSessionsLast7 > 0;
  // Chronic data: need sessions beyond the 7-day window to form a meaningful 28-day baseline
  const numSessionsBeyond7 = trainingLogs.filter(
    (log) => {
      const daysAgo = differenceInDays(today, parseISO(log.date));
      return daysAgo > 7 && daysAgo <= 28;
    }
  ).length;
  const hasChronicData = hasAcuteData && numSessionsBeyond7 > 0;

  return {
    acuteLoad,
    chronicLoad: chronicWeeklyAvg,
    acuteChronicRatio: ratio,
    isSpike,
    sustainedFatigue,
    isLowWorkload,
    hasAutoInjury,
    hasAcuteData,
    hasChronicData,
  };
}
