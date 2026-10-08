import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

function loadComponent(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  const output = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(createRequire(fileURLToPath(url)), module, module.exports);
  return module.exports;
}

const { HomeReadiness } = loadComponent('../components/HomeReadiness.tsx');
const { ReadinessGauge } = loadComponent('../components/ReadinessGauge.tsx');
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const baseProps = { score: 78, label: 'Ready', breakdown: { stress: 80, energy: 70, sleep: 76, fatigue: 70, load: 0 }, painScore: 30 };

test('zero load renders its background arc without coloured endpoint dots', () => {
  const markup = render(HomeReadiness, baseProps);
  const loadGroup = markup.match(/<g><title>Load:.*?<\/g>/)?.[0]?.split('<svg')[0];
  assert.ok(loadGroup);
  assert.equal((loadGroup.match(/<path /g) ?? []).length, 1);
  assert.ok(!loadGroup.includes('stroke-dasharray'));
  const partialGroup = render(HomeReadiness, { ...baseProps, breakdown: { ...baseProps.breakdown, load: 30 } }).match(/<g><title>Load:.*?<\/g>/)?.[0]?.split('<svg')[0];
  assert.equal((partialGroup.match(/<path /g) ?? []).length, 2);
});

test('empty readiness and fully depleted side metrics render only background tracks', () => {
  const markup = render(HomeReadiness, { score: 0, label: 'Empty', breakdown: { stress: 0, energy: 0, sleep: 0, fatigue: 0, load: 0 }, painScore: 100 });
  assert.equal((markup.match(/<circle cx="200"/g) ?? []).length, 1);
  assert.equal((markup.match(/<path [^>]*stroke-dasharray/g) ?? []).length, 0);
  assert.ok(markup.includes('Readiness score: 0 out of 100'));
});

test('compact gauge handles zero, invalid, partial and full scores without a phantom cap', () => {
  for (const score of [0, -10, Number.NaN]) {
    assert.equal((render(ReadinessGauge, { score, color: '#00d889', label: 'Ready' }).match(/<circle /g) ?? []).length, 1);
  }
  for (const score of [1, 50, 100, 120]) {
    const markup = render(ReadinessGauge, { score, color: '#00d889', label: 'Ready' });
    assert.equal((markup.match(/<circle /g) ?? []).length, 2);
    assert.ok(!markup.includes('stroke-dashoffset:-'));
  }
});
