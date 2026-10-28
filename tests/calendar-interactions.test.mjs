import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import React from 'react';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);

// Run component handlers and effects with persistent hook state, without a database or browser.
function harness(data = {}) {
  let cursor = 0;
  let slots = [];
  const componentSlots = new Map();
  let effects = [];
  const changed = (before, after) => !before || !after || after.some((value, i) => !Object.is(value, before[i]));
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      const stateSlots = slots;
      if (!(index in stateSlots)) stateSlots[index] = typeof initial === 'function' ? initial() : initial;
      return [stateSlots[index], value => { stateSlots[index] = typeof value === 'function' ? value(stateSlots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ??= { current: initial };
    },
    useMemo(compute, deps) {
      const index = cursor++;
      if (changed(slots[index]?.deps, deps)) slots[index] = { value: compute(), deps };
      return slots[index].value;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (changed(slots[index], deps)) { slots[index] = deps; effects.push(effect); }
    },
  };
  const mocks = {
    react: hooks,
    '@/lib/DataContext': { useData: () => data },
    '@/lib/AuthContext': { useAuth: () => ({ user: { id: 'player' } }) },
    '@/lib/calendar/attendance': { getPlayerRsvpTargetFromCalendarEvent: () => null },
    '@/components/calendar/PlayerRsvpControl': { PlayerRsvpControl: () => null },
    '@/lib/usePersistedState': { usePersistedState: (_key, initial) => hooks.useState(initial) },
    'next/navigation': { useRouter: () => ({ push() {}, replace() {} }), useSearchParams: () => new URLSearchParams() },
    uuid: { v4: () => 'new-id' },
  };
  const modules = new Map();
  function load(filename) {
    const absolute = path.resolve(root, filename);
    if (modules.has(absolute)) return modules.get(absolute).exports;
    const loaded = new Module(absolute);
    loaded.filename = absolute;
    loaded.paths = Module._nodeModulePaths(path.dirname(absolute));
    modules.set(absolute, loaded);
    loaded.require = name => {
      if (name in mocks) return mocks[name];
      const local = name.startsWith('@/') ? path.join(root, name.slice(2))
        : name.startsWith('.') ? path.resolve(path.dirname(absolute), name) : null;
      if (local) {
        const alias = '@/' + path.relative(root, local).replaceAll('\\', '/');
        if (alias in mocks) return mocks[alias];
        const target = [local, `${local}.ts`, `${local}.tsx`].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
        if (target) return load(target);
      }
      return require(name);
    };
    loaded._compile(ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, absolute);
    return loaded.exports;
  }
  return {
    load,
    render(Component, props = {}) {
      if (!componentSlots.has(Component)) componentSlots.set(Component, []);
      slots = componentSlots.get(Component);
      cursor = 0;
      return Component(props);
    },
    flush() { const pending = effects; effects = []; pending.forEach(effect => effect()); },
  };
}

function elements(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(child => elements(child, predicate));
  if (!tree || typeof tree !== 'object') return [];
  return [...(predicate(tree) ? [tree] : []), ...elements(tree.props?.children, predicate)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('');
  return typeof tree === 'object' && tree ? text(tree.props?.children) : String(tree ?? '');
}

function scrollContainer(rowHeight = 40) {
  return {
    scrollTop: 0,
    querySelector(selector) {
      const hour = Number(selector.match(/data-hour="(\d+)"/)[1]);
      return { offsetTop: 60 + hour * rowHeight };
    },
  };
}

function assertFullDay(tree) {
  assert.deepEqual(elements(tree, node => node.props?.['data-hour'] !== undefined).map(node => node.props['data-hour']),
    Array.from({ length: 24 }, (_, hour) => hour));
}

const event = {
  id: 'practice', eventTypeId: 'training', title: 'Team practice',
  start: '2026-10-28T15:00:00', end: '2026-10-28T16:30:00', recurrence: 'none',
  recurrenceConfig: { meta: { coachManaged: true, coachId: 'coach' } },
};
const defaultData = { calendarEvents: [event], calendarEventColorOverrides: [], customEventTypes: [], trainingLogs: [] };

test('initial reference is one hour before the earliest event, capped at 2pm, with all 24 hours retained', () => {
  const { CALENDAR_HOURS, getCalendarInitialHour } = harness().load('lib/calendar/schedule.ts');
  assert.deepEqual(CALENDAR_HOURS, Array.from({ length: 24 }, (_, hour) => hour));
  assert.equal(getCalendarInitialHour([{ startHour: 15 }, { startHour: 21 }]), 14);
  assert.equal(getCalendarInitialHour([{ startHour: 22 }]), 14);
  assert.equal(getCalendarInitialHour([{ startHour: 5 }, { startHour: 21 }]), 4);
  assert.equal(getCalendarInitialHour([{ startHour: 0 }]), 0);
  assert.equal(getCalendarInitialHour([]), 6);
  assert.equal(getCalendarInitialHour([{ startHour: NaN }]), 6);
});

test('long press preserves weekly scroll position across recreated dates and opening/closing actions', () => {
  const h = harness(defaultData);
  const { CalendarWeek } = h.load('components/CalendarWeek.tsx');
  let prompt;
  const props = () => ({ currentDate: new Date('2026-10-28T00:00:00'), onEventLongPress: value => { prompt = value; } });
  let tree = h.render(CalendarWeek, props());
  const scroller = elements(tree, node => node.props?.className?.includes('overflow-y-auto'))[0];
  const container = scrollContainer();
  scroller.ref.current = container;
  h.flush();
  assert.equal(container.scrollTop, 14 * 40);
  container.scrollTop = 160;
  const previousWindow = globalThis.window;
  let timer;
  globalThis.window = { setTimeout: callback => { timer = callback; return 1; }, clearTimeout() {} };
  try {
    elements(tree, node => !!node.props?.onPointerDown)[0].props.onPointerDown({ clientX: 100, clientY: 300 });
    timer();
    assert.equal(prompt.time, '15:00');
    tree = h.render(CalendarWeek, props());
    h.flush();
    assert.equal(container.scrollTop, 160);
    h.render(CalendarWeek, props());
    h.flush();
    assert.equal(container.scrollTop, 160);
    assertFullDay(tree);
    h.render(CalendarWeek, { ...props(), currentDate: new Date('2026-11-04T00:00:00') });
    h.flush();
    assert.equal(container.scrollTop, 6 * 40);
  } finally { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; }
});

test('weekly scroll reference uses recurrence overrides and excludes skipped occurrences', () => {
  const recurring = { ...event, recurrence: 'weekly', recurrenceConfig: { days: [3] },
    overrides: { '2026-10-28': { start: '2026-10-28T21:00', end: '2026-10-28T22:00' } } };
  const data = { ...defaultData, calendarEvents: [recurring] };
  const h = harness(data);
  const { CalendarWeek } = h.load('components/CalendarWeek.tsx');
  const render = () => h.render(CalendarWeek, { currentDate: new Date('2026-10-28T00:00:00') });
  const tree = render();
  assertFullDay(tree);
  const container = scrollContainer();
  elements(tree, node => node.props?.className?.includes('overflow-y-auto'))[0].ref.current = container;
  h.flush();
  assert.equal(container.scrollTop, 14 * 40);
  data.calendarEvents = [{ ...recurring, overrides: { '2026-10-28': { start: '2026-10-28T05:00', end: '2026-10-28T06:00' } } }];
  assertFullDay(render());
  h.flush();
  assert.equal(container.scrollTop, 4 * 40);
  data.calendarEvents = [{ ...recurring, excludedDates: ['2026-10-28'] }];
  assertFullDay(render());
  h.flush();
  assert.equal(container.scrollTop, 6 * 40);
});

test('player day view preserves scroll when session actions open', () => {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const h = harness({ ...defaultData, calendarEvents: [{ ...event, start: `${date}T15:00:00`, end: `${date}T16:00:00` }] });
  const Page = h.load('app/calendar/page.tsx').default;
  let page = h.render(Page);
  const header = elements(page, node => node.type === 'header')[0];
  assert.equal(elements(header, node => node.props?.['aria-label'] === 'Calendar view').length, 1);
  assert.equal(elements(header, node => node.props?.['aria-label'] === 'Add event').length, 1);
  elements(page, node => node.type === 'button' && text(node) === 'Day')[0].props.onClick();
  page = h.render(Page);
  let day = elements(page, node => node.type?.name === 'DayView')[0];
  let tree = h.render(day.type, day.props);
  assertFullDay(tree);
  const container = scrollContainer(44);
  elements(tree, node => node.props?.className?.includes('overflow-y-auto'))[0].ref.current = container;
  h.flush();
  assert.equal(container.scrollTop, 14 * 44);
  container.scrollTop = 120;
  day.props.onEventLongPress({ x: 100, y: 200, date, time: '15:00', duration: 60, sessionType: 'Team' });
  page = h.render(Page);
  day = elements(page, node => node.type?.name === 'DayView')[0];
  h.render(day.type, day.props);
  h.flush();
  assert.equal(container.scrollTop, 120);
  assert.equal(elements(page, node => node.type === 'button' && text(node).trim() === 'Log session').length, 1);
});

for (const [filename, exportName, collection] of [
  ['components/coach/calendar/TeamCalendar.tsx', 'TeamCalendar', 'items'],
  ['components/coach/players/PlayerCalendar.tsx', 'PlayerCalendar', 'events'],
]) {
  test(`${exportName} day and week use occurrence hours and preserve event type colours`, () => {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const h = harness();
    const Component = h.load(filename)[exportName];
    const props = { [collection]: [{ id: 'custom', title: 'Practice', type: 'training', eventTypeId: 'custom-practice', date,
      startTime: '15:00', endTime: '16:00', kind: 'event', visibleInCoachPlayerCalendar: true }], eventTypeColors: { 'custom-practice': '#845ef7' } };
    const parent = h.render(Component, props);
    const schedules = elements(parent, node => ['DaySchedule', 'WeekSchedule'].includes(node.type?.name));
    assert.equal(schedules.length, 2);
    for (const schedule of schedules) {
      const tree = h.render(schedule.type, schedule.props);
      assertFullDay(tree);
      assert.ok(elements(tree, node => node.props?.style?.backgroundColor === '#845ef7').length);
      const container = scrollContainer();
      elements(tree, node => node.props?.className?.includes('overflow-y-auto'))[0].ref.current = container;
      h.flush();
      assert.equal(container.scrollTop, 14 * 40);
      container.scrollTop = 80;
      h.render(schedule.type, { ...schedule.props, ...(schedule.props.currentDate ? { currentDate: new Date(today) } : { date: new Date(today) }) });
      h.flush();
      assert.equal(container.scrollTop, 80);
    }
  });
}

test('details picker and calendar agree on saved colour, precedence, and unknown coach types', () => {
  const data = { ...defaultData, calendarEventColorOverrides: [{ scope: 'event', eventId: event.id, color: '#845ef7' }] };
  const h = harness(data);
  const { resolveCalendarEventColor } = h.load('lib/calendar/colorOverrides.ts');
  const { CalendarWeek } = h.load('components/CalendarWeek.tsx');
  const calendar = h.render(CalendarWeek, { currentDate: new Date('2026-10-28T00:00:00') });
  assert.ok(elements(calendar, node => !!node.props?.onPointerDown).every(node => node.props.style.backgroundColor === '#845ef7'));
  const modalHarness = harness(data);
  const modal = modalHarness.render(modalHarness.load('components/EventModal.tsx').EventModal, { existingEvent: event, instanceDate: '2026-10-28', readOnly: true });
  assert.equal(elements(modal, node => node.type === 'input' && node.props.type === 'color')[0].props.value, '#845ef7');
  const overrides = [
    { scope: 'coach', coachId: 'coach', color: '#111111' },
    { scope: 'event_type', coachId: 'coach', eventTypeId: 'training', color: '#222222' },
    { scope: 'event', eventId: event.id, color: '#333333' },
  ];
  assert.equal(resolveCalendarEventColor(event, 'training', overrides, []), '#333333');
  assert.equal(resolveCalendarEventColor(event, 'training', overrides.slice(0, 2), []), '#222222');
  assert.equal(resolveCalendarEventColor(event, 'training', overrides.slice(0, 1), []), '#111111');
  assert.equal(resolveCalendarEventColor(event, 'training', [], []), '#845ef7');
  assert.equal(resolveCalendarEventColor({ ...event, color: '#abcdef' }, 'training', [], []), '#abcdef');
});

test('delete closes the options menu and offers equal-width delete/cancel actions without deleting early', () => {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const deleted = [];
  const h = harness({ wellnessLogs: {}, trainingLogs: [{ id: 'log', date, sessionType: 'Gym', duration: 90, intensity: 5 }], deleteTrainingLog: id => deleted.push(id) });
  const Page = h.load('app/log/page.tsx').default;
  const render = () => h.render(Page);
  let tree = render();
  elements(tree, node => node.props?.['aria-label'] === 'Training log options')[0].props.onClick();
  tree = render();
  elements(tree, node => node.type === 'button' && text(node).trim() === 'Delete')[0].props.onClick();
  tree = render();
  assert.equal(elements(tree, node => node.type === 'button' && text(node).trim() === 'Delete').length, 0);
  const actions = elements(tree, node => node.props?.className === 'grid grid-cols-2 gap-2' && text(node).includes('Delete Log'))[0];
  assert.ok(actions);
  assert.deepEqual(deleted, []);
  const buttons = elements(actions, node => node.type === 'button');
  assert.equal(text(buttons[0]).trim(), 'Delete Log');
  assert.equal(text(buttons[1]).trim(), 'Cancel');
  assert.match(buttons[1].props.className, /bg-gray-700/);
  buttons[1].props.onClick();
  assert.equal(elements(render(), node => node.type === 'button' && text(node).trim() === 'Delete Log').length, 0);
  assert.deepEqual(deleted, []);
  elements(render(), node => node.props?.['aria-label'] === 'Training log options')[0].props.onClick();
  elements(render(), node => node.type === 'button' && text(node).trim() === 'Delete')[0].props.onClick();
  elements(render(), node => node.type === 'button' && text(node).trim() === 'Delete Log')[0].props.onClick();
  assert.deepEqual(deleted, ['log']);
  assert.equal(elements(render(), node => node.type === 'button' && text(node).trim() === 'Delete Log').length, 0);
});
