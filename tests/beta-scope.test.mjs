import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PUBLIC_BETA_FEATURES,
  getPublicBetaDisabledRouteRule,
  isPublicBetaPublicRoute,
  isPublicBetaRoleEnabled,
} from '../lib/betaScope.mjs';

test('excluded public beta feature groups are locked off', () => {
  assert.deepEqual(PUBLIC_BETA_FEATURES, {
    aiAssistant: false,
    guardianAndMinorAccounts: false,
    subscriptionsAndPayments: false,
    advertising: false,
    healthIntegrations: false,
    unfinishedFeatures: false,
  });
  assert.equal(Object.isFrozen(PUBLIC_BETA_FEATURES), true);
});

test('only player and coach roles are available in the public beta', () => {
  assert.equal(isPublicBetaRoleEnabled('player'), true);
  assert.equal(isPublicBetaRoleEnabled('coach'), true);
  assert.equal(isPublicBetaRoleEnabled('guardian'), false);
  assert.equal(isPublicBetaRoleEnabled('admin'), false);
});

test('guardian and minor routes are blocked without overmatching stable routes', () => {
  assert.deepEqual(getPublicBetaDisabledRouteRule('/guardian/children/player-a'), {
    prefix: '/guardian',
    kind: 'page',
    redirectTo: '/',
  });
  assert.deepEqual(getPublicBetaDisabledRouteRule('/coach/guardians'), {
    prefix: '/coach/guardians',
    kind: 'page',
    redirectTo: '/coach/dashboard',
  });
  assert.deepEqual(getPublicBetaDisabledRouteRule('/profile/guardians/correction'), {
    prefix: '/profile/guardians',
    kind: 'page',
    redirectTo: '/profile',
  });
  assert.deepEqual(getPublicBetaDisabledRouteRule('/api/guardian/invitations'), {
    prefix: '/api/guardian',
    kind: 'api',
    redirectTo: null,
  });
  assert.equal(getPublicBetaDisabledRouteRule('/coach/players'), null);
  assert.equal(getPublicBetaDisabledRouteRule('/profile'), null);
  assert.equal(getPublicBetaDisabledRouteRule('/guardianship'), null);
});

test('legal, health, support, beta, and reset routes are public without overmatching', () => {
  for (const route of [
    '/beta',
    '/reset-password',
    '/privacy',
    '/terms',
    '/health-disclaimer',
    '/cookies',
    '/support',
  ]) {
    assert.equal(isPublicBetaPublicRoute(route), true, route);
  }
  assert.equal(isPublicBetaPublicRoute('/profile'), false);
  assert.equal(isPublicBetaPublicRoute('/privacy-settings'), false);
});
