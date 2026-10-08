import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  const output = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(name => {
    if (name.startsWith('@/')) return load(`../${name.slice(2)}.ts`);
    if (name.startsWith('.')) return load(new URL(`${name}.ts`, url));
    return require(name);
  }, module, module.exports);
  return module.exports;
}

const { buildTeamOverviewData } = load('../components/coach/overview/buildFromInsights.ts');
const { analyzeTrainingLoad } = load('../lib/training-load.ts');

function overviewForScore(loadScore) {
  return buildTeamOverviewData({
    analyticsData: {
      labels: ['Oct 7'],
      averages: {
        readinessTrend: [], energyFatigueLoad: [], sleepQualityAndTiming: [], stressVsSleepScore: [],
        multiFactorReadiness: [{ loadScore }],
      },
    },
    calendarData: { items: [], averages: [] },
    players: [],
  });
}

test('overview treats higher load scores as better and lower scores as worse', () => {
  const high = overviewForScore(84).keyMetrics.find(metric => metric.label === 'Load Score');
  const low = overviewForScore(20).keyMetrics.find(metric => metric.label === 'Load Score');
  assert.equal(high.value, 84);
  assert.equal(high.toneClass, 'text-[#84cc16]');
  assert.equal(low.value, 20);
  assert.equal(low.toneClass, 'text-[#991b1b]');
});

test('load defaults can produce high scores without recent sessions and preserve the no-data flag', () => {
  const asOf = new Date(2026, 9, 7);
  const empty = analyzeTrainingLoad([], [], asOf);
  assert.equal(empty.hasAcuteData, false);
  assert.equal(empty.sevenDayLoad, 0);
  assert.equal(Math.round(empty.loadScore), 87);
  const injury = analyzeTrainingLoad([], [{
    date: '2026-10-07', fatigue: 3, stress: 1, sleepDuration: 8, isInjury: true,
  }], asOf);
  assert.equal(injury.hasAcuteData, false);
  assert.equal(injury.sevenDayLoad, 0);
  assert.equal(Math.round(injury.loadScore), 84);
});
