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
    guardianAndMinorAccounts: true,
    subscriptionsAndPayments: false,
    advertising: false,
    healthIntegrations: false,
    unfinishedFeatures: false,
  });
  assert.equal(Object.isFrozen(PUBLIC_BETA_FEATURES), true);
});

test('player, coach and guardian roles are available in the public beta', () => {
  assert.equal(isPublicBetaRoleEnabled('player'), true);
  assert.equal(isPublicBetaRoleEnabled('coach'), true);
  assert.equal(isPublicBetaRoleEnabled('guardian'), true);
  assert.equal(isPublicBetaRoleEnabled('admin'), false);
});

test('Guardian routes are restored while access is checked by their account gates', () => {
 for (const route of ['/guardian/children/player-a','/coach/guardians','/profile/guardians','/api/guardian/invitations']) assert.equal(getPublicBetaDisabledRouteRule(route), null);
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
