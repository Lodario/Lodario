import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const output = ts.transpileModule(readFileSync(new URL('../lib/overlay-scrollbar.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const module = { exports: {} };
new Function('module', 'exports', output)(module, module.exports);
const { getScrollbarMetrics } = module.exports;

test('no thumb appears when content fits or the viewport is hidden', () => {
  assert.equal(getScrollbarMetrics(400, 400, 0), null);
  assert.equal(getScrollbarMetrics(400, 200, 0), null);
  assert.equal(getScrollbarMetrics(0, 1000, 0), null);
});

test('thumb reaches both ends of its viewport and maps drag travel to the full scroll range', () => {
  const start = getScrollbarMetrics(400, 1600, 0);
  const middle = getScrollbarMetrics(400, 1600, 600);
  const end = getScrollbarMetrics(400, 1600, 1200);
  assert.equal(start.thumbOffset, 0);
  assert.equal(middle.thumbOffset, start.travel / 2);
  assert.equal(end.thumbOffset + end.thumbSize, 396);
  assert.equal(start.maxScroll, 1200);
});

test('initial render matches before and after document becomes available', () => {
  const source = ts.transpileModule(readFileSync(new URL('../components/OverlayScrollbars.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  const require = createRequire(import.meta.url);
  new Function('require', 'module', 'exports', source)(
    name => name === '@/lib/overlay-scrollbar' ? module.exports : require(name), loaded, loaded.exports,
  );
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  try {
    delete globalThis.document;
    const server = renderToStaticMarkup(React.createElement(loaded.exports.OverlayScrollbars));
    globalThis.document = { body: {} };
    const initialClient = renderToStaticMarkup(React.createElement(loaded.exports.OverlayScrollbars));
    assert.equal(server, '');
    assert.equal(initialClient, server);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  }
});

test('overscroll and very long content keep the thumb inside its viewport', () => {
  assert.equal(getScrollbarMetrics(400, 1600, -80).thumbOffset, 0);
  const overshoot = getScrollbarMetrics(400, 1600, 2000);
  assert.equal(overshoot.thumbOffset, overshoot.travel);
  const long = getScrollbarMetrics(400, 100000, 0);
  assert.equal(long.thumbSize, 24);
  const small = getScrollbarMetrics(20, 1000, 0);
  assert.ok(small.thumbSize <= 16);
});
