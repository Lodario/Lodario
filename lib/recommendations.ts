import { ReadinessResult } from './readiness';
import { LoadResult } from './training-load';
import { UserProfile, InjuryRecord, CalendarEvent } from './types';

export interface RecommendationResult {
  intensity: 'Intense' | 'Moderate' | 'Light' | 'Recovery';
  message: string;
  focusAreas: string[];
}

export function generateRecommendation(
  readiness: ReadinessResult,
  load: LoadResult,
  activeInjuries: InjuryRecord[],
  profile: UserProfile | null,
  todaysEvents?: CalendarEvent[]
): RecommendationResult {
  
  const isInjured = activeInjuries.length > 0 || load.hasAutoInjury;

  let intensity: 'Intense' | 'Moderate' | 'Light' | 'Recovery' = 'Moderate';

  if (isInjured) {
    intensity = 'Recovery';
  } else if (readiness.score >= 75) {
    if (load.isSpike || load.sustainedFatigue) {
      intensity = 'Moderate';
    } else {
      intensity = 'Intense';
    }
  } else if (readiness.score >= 50) {
    intensity = 'Moderate';
  } else if (readiness.score >= 35) {
    intensity = 'Light';
  } else {
    intensity = 'Recovery';
  }

  // Factor in anticipated intensity from today's scheduled calendar events (#4)
  // If there is a high-intensity session scheduled today, reduce the individual recommendation
  if (!isInjured && todaysEvents && todaysEvents.length > 0) {
    const hasHighIntensityScheduled = todaysEvents.some(
      e => e.anticipatedIntensity === 'High'
    );
    const hasModerateIntensityScheduled = todaysEvents.some(
      e => e.anticipatedIntensity === 'Moderate'
    );

    if (hasHighIntensityScheduled) {
      // Cap individual recommendation to Light or lower
      if (intensity === 'Intense') intensity = 'Light';
      else if (intensity === 'Moderate') intensity = 'Light';
    } else if (hasModerateIntensityScheduled) {
      // Cap individual recommendation to Moderate or lower
      if (intensity === 'Intense') intensity = 'Moderate';
    }
  }

  let message = '';
  if (isInjured) {
    message = 'Focus on doctor/physio prescribed recovery. Do not push through pain. Prioritize rest, hydration, and nutrition.';
  } else if (intensity === 'Intense') {
    message = 'You are primed for a tough session. Push your limits today! Focus on game speed and explosive actions.';
  } else if (intensity === 'Moderate') {
    message = 'Solid state to train. Focus on quality touches and technical execution without over-exerting.';
  } else if (intensity === 'Light') {
    // Adjust message if high-intensity session is scheduled
    const hasHighScheduled = todaysEvents?.some(e => e.anticipatedIntensity === 'High');
    if (hasHighScheduled) {
      message = 'A high-intensity session is scheduled today. Keep any additional training light — focus on mobility, warm-up drills, or tactical review.';
    } else {
      message = 'Keep the workload light today. Focus on mobility, light touches, and tactical review to prevent injury.';
    }
  } else {
    message = 'Your body needs rest. Stick to active recovery, stretching, or take a complete day off to recharge.';
  }

  // Position + priority specific focus areas
  let focusAreas: string[] = [];
  if (profile && !isInjured && intensity !== 'Recovery') {
    if (profile.positions.includes('CM') || profile.positions.includes('AM')) {
      focusAreas.push('Scanning & Awareness');
    } else if (profile.positions.includes('W') || profile.positions.includes('FB')) {
      focusAreas.push('Crossing & Wide Play');
    } else if (profile.positions.includes('GK')) {
      focusAreas.push('Distribution & Reflexes');
    }

    if (profile.priorities.includes('Decision-making')) {
      focusAreas.push('Small-sided games or rapid decision drills');
    }
    if (profile.priorities.includes('Finishing') && intensity === 'Intense') {
      focusAreas.push('High-intensity shooting drills');
    }
  }

  return {
    intensity,
    message,
    focusAreas
  };
}
