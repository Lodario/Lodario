import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const modules = new Map();
function loadTypeScript(filename) {
  const absolute = path.resolve(root, filename);
  if (modules.has(absolute)) return modules.get(absolute).exports;
  const loaded = new Module(absolute);
  loaded.filename = absolute;
  loaded.paths = Module._nodeModulePaths(path.dirname(absolute));
  modules.set(absolute, loaded);
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = specifier => {
    const local = specifier.startsWith('@/') ? path.join(root, specifier.slice(2))
      : specifier.startsWith('.') ? path.resolve(path.dirname(absolute), specifier) : null;
    if (local && fs.existsSync(`${local}.ts`)) return loadTypeScript(`${local}.ts`);
    return originalRequire(specifier);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, absolute);
  return loaded.exports;
}

const { calculateReadiness } = loadTypeScript('lib/readiness.ts');
const { buildPlayerReminders } = loadTypeScript('lib/player-reminders.ts');
const log = { date: '2026-10-13', sleepTime: '23:00', wakeTime: '07:00', sleepDuration: 8, sleepQuality: 0, energy: 0, fatigue: 0, stress: 0, painActive: false, painLevel: 0 };

test('zero wellness values produce bounded readiness and represent no fatigue or stress', () => {
  const result = calculateReadiness(log, [log], 100, false, false, new Date('2026-10-13T12:00:00'));
  assert.equal(result.breakdown.energy, 0);
  assert.equal(result.breakdown.fatigue, 100);
  assert.equal(result.breakdown.stress, 100);
  for (const value of Object.values(result.breakdown)) assert.ok(value >= 0 && value <= 100);
  assert.ok(result.score >= 0 && result.score <= 100);
});

test('wellness reminders open the correct date directly in the full-screen form', () => {
  const reminders = buildPlayerReminders({ now: new Date('2026-10-13T12:00:00') });
  assert.equal(reminders.find(reminder => reminder.type === 'daily-wellness').action.href, '/log/wellness?date=2026-10-13');
  assert.equal(reminders.find(reminder => reminder.type === 'missed-wellness').action.href, '/log/wellness?date=2026-10-12');
});

test('session reminders preserve occurrence time, title, type and planned duration', () => {
  const reminders = buildPlayerReminders({
    now: new Date('2026-10-13T20:30:00'), wellnessLogs: { '2026-10-13': log, '2026-10-12': log },
    calendarEvents: [{ id: 'synthetic-session', eventTypeId: 'team-training', title: 'Team training', start: '2026-10-13T19:00:00', end: '2026-10-13T20:15:00', recurrence: 'none' }],
    customEventTypes: [{ id: 'team-training', name: 'Team training', color: '#ffd43b', isActivity: true }],
  });
  const session = reminders.find(reminder => reminder.action?.label === 'Log session');
  assert.ok(session);
  const query = new URL(session.action.href, 'https://lodario.example').searchParams;
  assert.equal(query.get('date'), '2026-10-13');
  assert.equal(query.get('time'), '19:00');
  assert.equal(query.get('title'), 'Team training');
  assert.equal(query.get('sessionType'), 'Team');
  assert.equal(query.get('duration'), '75');
});
