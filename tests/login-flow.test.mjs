import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import React from 'react';
import ts from 'typescript';
import { isPublicBetaRoleEnabled } from '../lib/betaScope.mjs';
import { resolveDefaultRoleRoute } from '../lib/roleRouting.mjs';

const require = createRequire(import.meta.url);
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
const isAppRole = role => ['player', 'coach', 'guardian'].includes(role);

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

// Exercise the actual components with controllable hook state and auth events.
function hooks() {
  const values = [];
  const effects = [];
  let cursor = 0;
  return {
    react: {
      ...React,
      useState(initial) {
        const index = cursor++;
        if (!(index in values)) values[index] = initial;
        return [values[index], next => {
          values[index] = typeof next === 'function' ? next(values[index]) : next;
        }];
      },
      useEffect(effect) { effects.push(effect); },
    },
    render(component, props = {}) { cursor = 0; return component(props); },
    mount() { return effects.splice(0).map(effect => effect()); },
  };
}

function load(relativePath, mocks, globals = {}) {
  const filename = new URL(`../${relativePath}`, import.meta.url);
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    module, exports: module.exports,
    require: name => mocks[name] ?? require(name),
    setTimeout, clearTimeout, console,
    window: { localStorage: { getItem: () => null } },
    ...globals,
  });
  return module.exports;
}

function authHarness(initialSession, { profileRole = 'coach', linkedRoles = [], profileRequest, savedRole } = {}) {
  const runtime = hooks();
  const requests = [];
  const signups = [];
  let listener;
  const supabase = {
    auth: {
      signUp: async payload => { signups.push(payload); return { error: null }; },
      getSession: async () => ({ data: { session: initialSession } }),
      onAuthStateChange(callback) {
        listener = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
    from(table) {
      requests.push(table);
      const result = table === 'profiles'
        ? profileRequest?.promise ?? Promise.resolve({ data: profileRole ? { role: profileRole } : null })
        : Promise.resolve({ data: linkedRoles.map(role => ({ role })) });
      const query = { select: () => query, eq: () => query, maybeSingle: () => result, then: result.then.bind(result) };
      return query;
    },
  };
  const { AuthProvider } = load('lib/AuthContext.tsx', {
    react: runtime.react,
    './supabase': { supabase },
    './signup-consent': load('lib/signup-consent.ts', {}),
    './routeRoles': { isAppRole },
    './betaScope.mjs': { isPublicBetaRoleEnabled },
  }, { window: { localStorage: { getItem: () => savedRole ?? null } } });
  const state = () => runtime.render(AuthProvider).props.value;
  state();
  const [cleanup] = runtime.mount();
  return { state, requests, signups, emit: (event, session) => listener(event, session), cleanup };
}

const session = (id = 'account-a', role = 'coach') => ({ user: { id, user_metadata: { role } }, access_token: 'test-token' });

test('session bootstrap shares role lookup and starts both database reads together', async () => {
  const profileRequest = deferred();
  const harness = authHarness(session(), { profileRequest });
  try {
    harness.emit('INITIAL_SESSION', session());
    await tick();
    assert.deepEqual(harness.requests, ['profiles', 'user_account_roles']);
    assert.equal(harness.state().isLoading, true);
    profileRequest.resolve({ data: { role: 'coach' } });
    await tick();
    assert.equal(harness.state().userRole, 'coach');
    assert.equal(harness.state().isLoading, false);
  } finally { harness.cleanup(); }
});

test('token refresh preserves the workspace and user reference without querying roles again', async () => {
  const harness = authHarness(session());
  try {
    await tick();
    const originalUser = harness.state().user;
    harness.emit('TOKEN_REFRESHED', { ...session(), access_token: 'refreshed-token' });
    await tick();
    assert.equal(harness.state().user, originalUser);
    assert.equal(harness.state().isLoading, false);
    assert.equal(harness.state().session.access_token, 'refreshed-token');
    assert.deepEqual(harness.requests, ['profiles', 'user_account_roles']);
  } finally { harness.cleanup(); }
});

test('sign-out prevents a slow role lookup from restoring the previous account', async () => {
  const profileRequest = deferred();
  const harness = authHarness(session(), { profileRequest });
  try {
    await tick();
    harness.emit('SIGNED_OUT', null);
    await tick();
    profileRequest.resolve({ data: { role: 'coach' } });
    await tick();
    assert.equal(harness.state().user, null);
    assert.equal(harness.state().userRole, null);
    assert.equal(harness.state().isLoading, false);
    assert.deepEqual(Array.from(harness.state().availableRoles), []);
  } finally { harness.cleanup(); }
});

test('linked roles restore the last valid workspace and ignore unavailable saved roles', async () => {
  for (const [savedRole, expected] of [['guardian', 'guardian'], ['coach', 'player']]) {
    const harness = authHarness(session('account-a', 'player'), {
      profileRole: 'player', linkedRoles: ['guardian'], savedRole,
    });
    try {
      await tick();
      assert.equal(harness.state().userRole, expected);
      assert.deepEqual(Array.from(harness.state().availableRoles), ['player', 'guardian']);
    } finally { harness.cleanup(); }
  }
});

test('all role mismatches redirect automatically and hide the wrong workspace', () => {
  for (const userRole of ['player', 'coach', 'guardian']) {
    for (const requiredRole of ['player', 'coach', 'guardian']) {
      const runtime = hooks();
      const redirects = [];
      const AppLoadingScreen = () => null;
      const { AuthGate } = load('components/AuthGate.tsx', {
        react: runtime.react,
        'next/navigation': { useRouter: () => ({ replace: route => redirects.push(route) }) },
        '@/lib/AuthContext': { useAuth: () => ({ user: session().user, userRole, isLoading: false }) },
        '@/components/AppLogo': { AppLogo: () => null },
        '@/components/AppLoadingScreen': { AppLoadingScreen },
        '@/components/SignupConsentNotice': { SignupConsentNotice: () => null },
        '@/components/legal/PublicLegalLinks': { PublicLegalLinks: () => null },
        '@/lib/routeRoles': { getDefaultRouteForRole: resolveDefaultRoleRoute },
        '@/lib/betaScope.mjs': {},
      });
      const view = runtime.render(AuthGate, { requiredRole, children: 'workspace-content' });
      runtime.mount();
      if (userRole === requiredRole) {
        assert.deepEqual(redirects, []);
        assert.equal(view.props.children, 'workspace-content');
      } else {
        assert.deepEqual(redirects, [resolveDefaultRoleRoute(userRole)]);
        assert.equal(view.type, AppLoadingScreen);
      }
    }
  }
});

test('signup keeps marketing optional and records the selected pending preference', async () => {
  const harness = authHarness(null);
  try {
    for (const choice of [undefined, false, true]) {
      const result = await harness.state().signUp('sample@example.test', 'sample-password', undefined,
        choice === undefined ? undefined : { marketingEmails: choice });
      assert.equal(result.error, null);
      const preference = harness.signups.at(-1).options.data.marketing_signup_preference;
      assert.equal(preference.requested, choice === true);
      assert.equal(preference.status, 'pending');
      assert.equal(preference.source, 'signup');
    }
  } finally { harness.cleanup(); }
});
