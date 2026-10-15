import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import React from 'react';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
function loader(mocks = {}, extraExports = {}) {
  const cache = new Map();
  function load(file) {
    const absolute = path.resolve(root, file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} };
    cache.set(absolute, module);
    const source = readFileSync(absolute, 'utf8') + (extraExports[file] ? `\nexport { ${extraExports[file]} };` : '');
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', output)(name => {
      if (name in mocks) return mocks[name];
      const local = name.startsWith('@/') ? path.join(root, name.slice(2))
        : name.startsWith('.') ? path.resolve(path.dirname(absolute), name) : null;
      if (local) {
        for (const suffix of ['', '.ts', '.tsx']) {
          if (existsSync(local + suffix) && /\.tsx?$/.test(local + suffix)) return load(path.relative(root, local + suffix).replaceAll('\\', '/'));
        }
      }
      return require(name);
    }, module, module.exports);
    return module.exports;
  }
  return load;
}

const load = loader({ '@/lib/supabase': { supabase: {} } }, {
  'components/coach/players/realData.ts': 'buildDatasetForPlayer, mapWellnessRowsToWellnessLogs, mapTrainingRowsToTrainingLogs',
});
const { buildDatasetForPlayer, mapWellnessRowsToWellnessLogs, mapTrainingRowsToTrainingLogs } = load('components/coach/players/realData.ts');
const { buildTeamAnalyticsDataFromPlayers } = load('components/coach/analytics/buildFromPlayers.ts');
const { calculatePlayerReadinessForDate } = load('lib/readiness.ts');
const { calculateSessionLoad } = load('lib/training-load.ts');
const wellnessRows = Array.from({ length: 11 }, (_, i) => ({
  date: `2026-10-${String(i + 1).padStart(2, '0')}`, energy: i, fatigue: 10 - i, stress: i,
  sleep_duration: 3 + i / 2, sleep_quality: i, sleep_time: '23:00', wake_time: '07:00',
  pain_active: false, pain_level: 0, is_injury: false,
}));
const trainingRows = wellnessRows.filter((_, i) => i % 2 === 0).map((row, i) => ({
  id: `session-${i}`, date: row.date, session_type: 'Team', intensity: i + 1, duration: 20,
  sprinting: 'no', created_at: `${row.date}T12:00:00Z`,
}));
function dataset(id, wellness = wellnessRows, training = trainingRows) {
  return buildDatasetForPlayer({
    player: { id, teamId: 'test-team', name: id, age: 20, positions: [] },
    wellnessRows: wellness, trainingRows: training, calendarRows: [], teamCalendarRows: [],
    activityByPlayerAndType: new Map(), activityByCoachAndType: new Map(),
    injuryRows: [], injuryQueryError: null, attendanceRows: [],
  });
}
const player = dataset('player-a');

test('all individual coach analytics agree with player calculations and logs, including October 1 and 0/10 extremes', () => {
  const wellness = mapWellnessRowsToWellnessLogs(wellnessRows);
  const training = mapTrainingRowsToTrainingLogs(trainingRows);
  for (const row of wellnessRows) {
    const date = row.date;
    const point = key => player.analytics[key].find(item => item.date === date);
    const result = calculatePlayerReadinessForDate(wellness, training, new Date(`${date}T00:00:00`));
    assert.equal(point('readinessTrend').readinessScore, result.readiness.score);
    assert.equal(point('multiFactorReadiness').readinessScore, result.readiness.score);
    assert.equal(point('energyFatigueLoad').energy, row.energy);
    assert.equal(point('multiFactorReadiness').energyScore, row.energy * 10);
    assert.equal(point('energyFatigueLoad').fatigue, row.fatigue);
    assert.equal(point('multiFactorReadiness').fatigueScore, row.fatigue * 10);
    assert.equal(point('stressVsSleepScore').stress, row.stress * 10);
    assert.equal(point('multiFactorReadiness').stressScore, row.stress * 10);
    assert.equal(point('sleepQualityAndTiming').sleepHours, row.sleep_duration);
    assert.equal(point('sleepQualityAndTiming').sleepQualityScore, row.sleep_quality * 10);
    assert.equal(point('sleepQualityAndTiming').sleepScore, result.readiness.breakdown.sleep);
    assert.equal(point('multiFactorReadiness').sleepScore, result.readiness.breakdown.sleep);
    assert.equal(point('stressVsSleepScore').sleepScore, result.readiness.breakdown.sleep);
    const dailyLoad = Math.round(training.filter(log => log.date === date).reduce((sum, log) => sum + calculateSessionLoad(log), 0));
    assert.equal(point('energyFatigueLoad').acuteTrainingLoad, dailyLoad);
    assert.equal(point('multiFactorReadiness').acuteTrainingLoad, dailyLoad);
    assert.equal(point('multiFactorReadiness').loadScore, Math.round(result.load.loadScore));
  }
  assert.equal(player.analytics.multiFactorReadiness[0].fatigueScore, 100);
  assert.equal(player.analytics.multiFactorReadiness.at(-1).fatigueScore, 0);
});

test('team averages and individual comparisons agree for every metric, including a player with training but no wellness', () => {
  const second = dataset('player-b', [], trainingRows.map(row => ({ ...row, intensity: 10 })));
  const team = buildTeamAnalyticsDataFromPlayers({ teamId: 'test-team', players: [player, second], teamAveragesMetrics: [] });
  for (const row of wellnessRows) {
    const point = key => team.averages[key].find(item => item.date === row.date);
    assert.equal(point('multiFactorReadiness').acuteTrainingLoad, point('energyFatigueLoad').acuteTrainingLoad);
    assert.equal(point('energyFatigueLoad').energy * 10, point('multiFactorReadiness').energyScore);
    assert.equal(point('energyFatigueLoad').fatigue * 10, point('multiFactorReadiness').fatigueScore);
    assert.equal(second.analytics.energyFatigueLoad.find(item => item.date === row.date)?.fatigue ?? null, null);
    for (const key of ['readinessScore', 'sleepScore', 'energyScore', 'fatigueScore', 'stressScore', 'loadScore']) {
      assert.equal(point('multiFactorReadiness')[key], player.analytics.multiFactorReadiness.find(item => item.date === row.date)[key]);
    }
    const comparison = team.individualsByLabel[point('readinessTrend').label][0];
    assert.equal(comparison.readinessScore, point('readinessTrend').readinessScore);
    assert.equal(comparison.fatigue * 10, point('multiFactorReadiness').fatigueScore);
    assert.equal(comparison.stress, point('multiFactorReadiness').stressScore);
    assert.equal(comparison.sleepScore, point('multiFactorReadiness').sleepScore);
  }
});

test('team summary numbers include reported zeros and exclude players without wellness', () => {
  const { buildTeamCalendarDataFromPlayers } = load('lib/coach/teamInsights.ts');
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const zero = { ...wellnessRows[0], date: today, energy: 0, fatigue: 0, stress: 0, sleep_quality: 0, sleep_duration: 0 };
  const ten = { ...zero, energy: 10, fatigue: 10, stress: 10, sleep_quality: 10, sleep_duration: 10 };
  const players = [dataset('zero', [zero], []), dataset('ten', [ten], []), dataset('missing', [], [{ ...trainingRows[0], date: today }])];
  const metrics = buildTeamCalendarDataFromPlayers('test-team', players).averages;
  for (const label of ['Team Energy', 'Team Fatigue', 'Team Stress', 'Team Sleep Quality']) {
    assert.equal(metrics.find(metric => metric.label === label)?.value, '50', label);
  }
  const empty = buildTeamAnalyticsDataFromPlayers({ teamId: 'test-team', players: [players[2]], teamAveragesMetrics: [] });
  assert.equal(empty.averages.energyFatigueLoad[0].energy, null);
  assert.equal(empty.averages.energyFatigueLoad[0].fatigue, null);
  assert.ok(empty.averages.energyFatigueLoad[0].acuteTrainingLoad > 0);
});

function descendants(element) {
  if (!React.isValidElement(element)) return [];
  return [element, ...React.Children.toArray(element.props.children).flatMap(descendants)];
}

test('player energy/fatigue and readiness chart data preserve legitimate zeros', () => {
  const charts = loader({
    '../lib/DataContext': { useData: () => ({ wellnessLogs: { [wellnessRows[0].date]: mapWellnessRowsToWellnessLogs(wellnessRows)[0] }, trainingLogs: [] }) },
    '../lib/readiness': { calculatePlayerReadinessForDate: () => ({ readiness: { score: 0 } }) },
  })('components/Charts.tsx');
  // Unlimited-length range includes the fixture regardless of today's date.
  for (const name of ['FatigueEnergyChart', 'ReadinessChart']) {
    const tree = descendants(charts[name]({ days: 1000 }));
    const chart = tree.find(item => Array.isArray(item.props.data));
    assert.ok(chart);
    assert.equal(chart.props.data.length, 1);
    if (name === 'FatigueEnergyChart') {
      assert.equal(chart.props.data[0].energy, 0);
      assert.equal(chart.props.data[0].fatigue, 10);
    } else assert.equal(chart.props.data[0].score, 0);
  }
});

test('history remembers the last choice across browser sessions, views, accounts and tabs', () => {
  const storage = new Map();
  let userId = 'coach-a';
  let blocked = false;
  const previousWindow = globalThis.window;
  const storageEvents = new Set();
  globalThis.window = { localStorage: {
    getItem: key => { if (blocked) throw Error('blocked'); return storage.get(key); },
    setItem: (key, value) => { if (blocked) throw Error('blocked'); storage.set(key, value); },
  },
    addEventListener: (name, listener) => { if (name === 'storage') storageEvents.add(listener); },
    removeEventListener: (name, listener) => { if (name === 'storage') storageEvents.delete(listener); },
  };
  try {
    let notifications = 0;
    const hook = loader({
      react: { useCallback: callback => callback, useSyncExternalStore: (subscribe, snapshot) => { subscribe(() => notifications++); return snapshot(); } },
      '@/lib/AuthContext': { useAuth: () => ({ user: { id: userId } }) },
    })('lib/useAnalyticsHistoryRange.ts').useAnalyticsHistoryRange;
    assert.equal(hook()[0], '7');
    hook()[1]('30');
    assert.equal(hook()[0], '30');
    assert.ok(notifications > 0);
    userId = 'player-b';
    assert.equal(hook()[0], '7');
    blocked = true;
    hook()[1]('14');
    assert.equal(hook()[0], '14');
    blocked = false;
    userId = 'coach-a';
    assert.equal(hook()[0], '30');
    // A new module instance represents a later visit with no in-memory selection.
    const fresh = loader({
      react: { useCallback: callback => callback, useSyncExternalStore: (_, snapshot) => snapshot() },
      '@/lib/AuthContext': { useAuth: () => ({ user: { id: userId } }) },
    })('lib/useAnalyticsHistoryRange.ts').useAnalyticsHistoryRange;
    assert.equal(fresh()[0], '30');
    storage.set('lodario:analytics:history-range:coach-a', 'unlimited');
    storageEvents.forEach(listener => listener({ key: 'lodario:analytics:history-range:coach-a' }));
    assert.equal(hook()[0], 'unlimited');
    assert.equal(fresh()[0], 'unlimited');
    storage.set('lodario:analytics:history-range:coach-a', 'invalid');
    assert.equal(fresh()[0], '7');
  } finally { globalThis.window = previousWindow; }
});

test('every team and coach player graph binds its labelled series to the expected numeric data and upward axes', () => {
  const pages = [
    ['components/coach/players/PlayersPage.tsx', 'AnalyticsView', { playerDataset: player }],
    ['components/coach/analytics/CoachAnalyticsPage.tsx', 'AveragesView', {
      legendItems: [], teamAveragesMetrics: [],
      averages: buildTeamAnalyticsDataFromPlayers({ teamId: 'test-team', players: [player], teamAveragesMetrics: [] }).averages,
    }],
  ];
  const expected = [
    ['readinessScore'], ['acuteTrainingLoad', 'energy', 'fatigue'],
    ['sleepHours', 'sleepQualityScore', 'sleepScore'], ['stress', 'sleepScore'],
    ['acuteTrainingLoad', 'readinessScore', 'sleepScore', 'energyScore', 'fatigueScore', 'stressScore', 'loadScore'],
  ];
  for (const [file, name, props] of pages) {
    const source = readFileSync(path.join(root, file), 'utf8');
    const mocks = Object.fromEntries([...source.matchAll(/from ['"](@\/[^'"]+)['"]/g)].map(([, specifier]) => [
      specifier, new Proxy({}, { get: (_, symbol) => String(symbol) }),
    ]));
    const view = loader(mocks, { [file]: name })(file)[name](props);
    const graphs = descendants(view).filter(item => item.props.graphNumber);
    assert.equal(graphs.length, 5);
    graphs.forEach((graph, index) => {
      assert.deepEqual(graph.props.series.map(series => series.dataKey), expected[index]);
      assert.equal(graph.props.leftDomain[0], 0);
      for (const point of graph.props.data) {
        for (const series of graph.props.series) assert.equal(typeof point[series.dataKey], 'number');
      }
    });
  }
});

test('startup waits for sequential loading gates and never replays the branded splash after completion', () => {
  const states = [], dependencies = [], cleanups = [];
  let cursor = 0, pendingEffects = [];
  let contextValue = null;
  const frames = new Map();
  let frameId = 0;
  const previousRequest = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  const react = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useCallback: callback => callback,
    useContext: () => contextValue,
    useEffect(effect, deps) {
      const index = cursor++;
      if (!dependencies[index] || deps.some((value, i) => value !== dependencies[index][i])) {
        pendingEffects.push(() => { cleanups[index]?.(); cleanups[index] = effect(); });
        dependencies[index] = deps;
      }
    },
  };
  const { AppStartupProvider, AppLoadingScreen } = loader({ react })('components/AppLoadingScreen.tsx');
  const render = () => {
    cursor = 0;
    const view = AppStartupProvider({ children: 'app' });
    contextValue = view.props.value;
    pendingEffects.splice(0).forEach(effect => effect());
    return view;
  };
  const advanceFrame = () => { const queued = [...frames.values()]; frames.clear(); queued.forEach(callback => callback()); };
  try {
    assert.ok(render().props.children[1]);
    const releaseAuth = contextValue();
    render();
    advanceFrame(); advanceFrame();
    assert.ok(render().props.children[1]);
    releaseAuth();
    const releaseTeams = contextValue();
    render();
    advanceFrame(); advanceFrame();
    assert.ok(render().props.children[1]);
    releaseTeams();
    render();
    advanceFrame(); advanceFrame();
    assert.equal(render().props.children[1], null);
    assert.equal(contextValue, null);
    // Later gates show a small inline spinner, never a fixed overlay or GIF.
    const laterLoading = descendants(AppLoadingScreen());
    assert.ok(laterLoading.some(item => item.props.role === 'status'));
    assert.ok(laterLoading.every(item => item.type !== 'img' && !item.props.className?.includes('fixed')));
    assert.equal(render().props.children[1], null);
  } finally {
    globalThis.requestAnimationFrame = previousRequest;
    globalThis.cancelAnimationFrame = previousCancel;
  }
});
