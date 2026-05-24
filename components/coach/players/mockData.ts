import type { TeamPlayerDataset } from '@/components/coach/players/types';

const chartLabels = ['May 12', 'May 13', 'May 14', 'May 15', 'May 16', 'May 17', 'May 18', 'May 19'];

const baseReadiness = [76, 81, 78, 84, 80, 86, 89, 87];
const baseEnergy = [6, 7, 6, 8, 7, 8, 9, 8];
const baseFatigue = [5, 4, 6, 4, 5, 3, 3, 4];
const baseAcuteLoad = [510, 540, 590, 560, 610, 640, 615, 670];
const baseSleepHours = [7.1, 7.6, 6.8, 7.9, 7.2, 8.0, 8.2, 7.8];
const baseSleepQuality = [72, 78, 70, 82, 76, 85, 88, 84];
const baseSleepScore = [74, 80, 71, 84, 78, 87, 90, 86];
const baseStress = [61, 54, 66, 49, 58, 45, 40, 46];
const baseLoadScore = [63, 67, 73, 70, 76, 79, 75, 82];

const bedTimes = ['23:18', '22:54', '23:40', '22:46', '23:05', '22:32', '22:20', '22:44'];
const wakeTimes = ['07:08', '06:59', '07:19', '06:52', '07:11', '06:45', '06:38', '06:55'];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function buildAnalytics(seed: number) {
  return {
    readinessTrend: chartLabels.map((label, index) => ({
      label,
      readinessScore: clamp(baseReadiness[index] + seed, 55, 98),
    })),
    energyFatigueLoad: chartLabels.map((label, index) => {
      const energy = clamp(baseEnergy[index] + Math.round(seed / 3), 1, 10);
      const fatigue = clamp(baseFatigue[index] - Math.round(seed / 4), 1, 10);

      return {
        label,
        energy,
        fatigue,
        acuteTrainingLoad: clamp(baseAcuteLoad[index] + seed * 9, 320, 920),
      };
    }),
    sleepQualityAndTiming: chartLabels.map((label, index) => ({
      label,
      sleepHours: roundOne(baseSleepHours[index] + seed * 0.03),
      sleepQualityScore: clamp(baseSleepQuality[index] + seed, 40, 99),
      sleepScore: clamp(baseSleepScore[index] + seed, 42, 99),
      bedTime: bedTimes[index],
      wakeTime: wakeTimes[index],
    })),
    stressVsSleepScore: chartLabels.map((label, index) => ({
      label,
      stress: clamp(baseStress[index] - seed, 15, 95),
      sleepScore: clamp(baseSleepScore[index] + seed, 42, 99),
    })),
    multiFactorReadiness: chartLabels.map((label, index) => {
      const readinessScore = clamp(baseReadiness[index] + seed, 55, 98);
      const sleepScore = clamp(baseSleepScore[index] + seed, 42, 99);
      const energyScore = clamp((baseEnergy[index] + Math.round(seed / 3)) * 10, 10, 100);
      const fatigueScore = clamp((baseFatigue[index] - Math.round(seed / 4)) * 10, 10, 100);
      const stressScore = clamp(baseStress[index] - seed, 15, 95);
      const loadScore = clamp(baseLoadScore[index] + seed, 30, 99);

      return {
        label,
        readinessScore,
        sleepScore,
        energyScore,
        fatigueScore,
        stressScore,
        loadScore,
      };
    }),
  };
}

function buildCalendarEvents(playerId: string, teamId: string, shiftDays: number) {
  const baseEvents = [
    { dayOffset: 0, startTime: '09:00', endTime: '10:30', title: 'Gym Lower Body', type: 'gym' as const },
    { dayOffset: 1, startTime: '17:00', endTime: '18:15', title: 'Solo Finishing', type: 'solo' as const },
    { dayOffset: 2, startTime: '08:00', endTime: '09:00', title: 'Gym Upper Body', type: 'gym' as const },
    { dayOffset: 4, startTime: '16:30', endTime: '17:40', title: 'Solo Speed Endurance', type: 'solo' as const },
    { dayOffset: 5, startTime: '10:00', endTime: '11:15', title: 'Gym Recovery Circuit', type: 'gym' as const },
  ];

  const referenceDate = new Date('2026-05-18T00:00:00');

  return baseEvents.map((event, index) => {
    const date = new Date(referenceDate);
    date.setDate(referenceDate.getDate() + event.dayOffset + shiftDays);

    return {
      id: `${playerId}-event-${index + 1}`,
      playerId,
      teamId,
      title: event.title,
      type: event.type,
      date: date.toISOString().slice(0, 10),
      startTime: event.startTime,
      endTime: event.endTime,
    };
  });
}

const teamPlayerDatasets: Record<string, TeamPlayerDataset[]> = {
  'whitby-u19': [
    {
      player: {
        id: 'whitby-u19-ndawg',
        teamId: 'whitby-u19',
        name: 'Nathan Dawg',
        jerseyNumber: 12,
        positions: ['W', 'AM', 'ST'],
        age: 19,
        heightCm: 179,
        weightKg: 68,
      },
      wellness: { readinessScore: 84, fatigue: 90, loadScore: 85 },
      analytics: buildAnalytics(0),
      calendarEvents: buildCalendarEvents('whitby-u19-ndawg', 'whitby-u19', 0),
    },
    {
      player: {
        id: 'whitby-u19-azuri',
        teamId: 'whitby-u19',
        name: 'Ari Zuri',
        jerseyNumber: 7,
        positions: ['RW', 'ST'],
        age: 18,
        heightCm: 175,
        weightKg: 66,
      },
      wellness: { readinessScore: 88, fatigue: 74, loadScore: 79 },
      analytics: buildAnalytics(4),
      calendarEvents: buildCalendarEvents('whitby-u19-azuri', 'whitby-u19', 1),
    },
  ],
  'whitby-u17': [
    {
      player: {
        id: 'whitby-u17-jholland',
        teamId: 'whitby-u17',
        name: 'Jules Holland',
        jerseyNumber: 4,
        positions: ['CB', 'DM'],
        age: 16,
        heightCm: 183,
        weightKg: 71,
      },
      wellness: { readinessScore: 79, fatigue: 82, loadScore: 77 },
      analytics: buildAnalytics(-3),
      calendarEvents: buildCalendarEvents('whitby-u17-jholland', 'whitby-u17', 0),
    },
    {
      player: {
        id: 'whitby-u17-fmora',
        teamId: 'whitby-u17',
        name: 'Faye Mora',
        jerseyNumber: 10,
        positions: ['AM', 'W'],
        age: 17,
        heightCm: 170,
        weightKg: 61,
      },
      wellness: { readinessScore: 83, fatigue: 76, loadScore: 81 },
      analytics: buildAnalytics(2),
      calendarEvents: buildCalendarEvents('whitby-u17-fmora', 'whitby-u17', 2),
    },
  ],
  'seattle-u23': [
    {
      player: {
        id: 'seattle-u23-rcole',
        teamId: 'seattle-u23',
        name: 'Ronan Cole',
        jerseyNumber: 9,
        positions: ['ST'],
        age: 22,
        heightCm: 186,
        weightKg: 78,
      },
      wellness: { readinessScore: 86, fatigue: 72, loadScore: 88 },
      analytics: buildAnalytics(3),
      calendarEvents: buildCalendarEvents('seattle-u23-rcole', 'seattle-u23', 0),
    },
    {
      player: {
        id: 'seattle-u23-ktan',
        teamId: 'seattle-u23',
        name: 'Kai Tan',
        jerseyNumber: 6,
        positions: ['CM', 'DM'],
        age: 21,
        heightCm: 181,
        weightKg: 74,
      },
      wellness: { readinessScore: 81, fatigue: 80, loadScore: 83 },
      analytics: buildAnalytics(-1),
      calendarEvents: buildCalendarEvents('seattle-u23-ktan', 'seattle-u23', 1),
    },
  ],
  'ridgeview-w': [
    {
      player: {
        id: 'ridgeview-w-lben',
        teamId: 'ridgeview-w',
        name: 'Lena Ben',
        jerseyNumber: 11,
        positions: ['LW', 'ST'],
        age: 20,
        heightCm: 167,
        weightKg: 60,
      },
      wellness: { readinessScore: 90, fatigue: 70, loadScore: 84 },
      analytics: buildAnalytics(5),
      calendarEvents: buildCalendarEvents('ridgeview-w-lben', 'ridgeview-w', 0),
    },
    {
      player: {
        id: 'ridgeview-w-msaad',
        teamId: 'ridgeview-w',
        name: 'Mira Saad',
        jerseyNumber: 3,
        positions: ['RB', 'CB'],
        age: 21,
        heightCm: 171,
        weightKg: 64,
      },
      wellness: { readinessScore: 85, fatigue: 77, loadScore: 80 },
      analytics: buildAnalytics(1),
      calendarEvents: buildCalendarEvents('ridgeview-w-msaad', 'ridgeview-w', 2),
    },
  ],
};

export const analyticsLegendItems = [
  'Readiness Score trend',
  'Energy vs Fatigue vs Acute Training Load',
  'Sleep Time vs Sleep Quality vs Sleep Score, including sleep and wake timing',
  'Stress vs Sleep Score',
  'Sleep Score + Energy + Fatigue + Stress + Load Score vs Readiness Score',
];

export function getTeamPlayers(teamId: string) {
  return teamPlayerDatasets[teamId] ?? [];
}
