export const PUBLIC_BETA_FEATURES = Object.freeze({
  aiAssistant: false,
  guardianAndMinorAccounts: false,
  subscriptionsAndPayments: false,
  advertising: false,
  healthIntegrations: false,
  unfinishedFeatures: false,
});

export const PUBLIC_BETA_DISABLED_ROUTE_RULES = Object.freeze([
  Object.freeze({ prefix: '/api/guardian', kind: 'api', redirectTo: null }),
  Object.freeze({ prefix: '/coach/guardians', kind: 'page', redirectTo: '/coach/dashboard' }),
  Object.freeze({ prefix: '/profile/guardians', kind: 'page', redirectTo: '/profile' }),
  Object.freeze({ prefix: '/guardian', kind: 'page', redirectTo: '/' }),
]);

export const PUBLIC_BETA_UNAVAILABLE_MESSAGE =
  'This feature is not available in the Lodario 18+ public beta.';

export const PUBLIC_BETA_PUBLIC_ROUTE_PREFIXES = Object.freeze([
  '/beta',
  '/reset-password',
  '/privacy',
  '/terms',
  '/health-disclaimer',
  '/cookies',
  '/support',
]);

function isPathWithinPrefix(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function getPublicBetaDisabledRouteRule(pathname) {
  return PUBLIC_BETA_DISABLED_ROUTE_RULES.find((rule) =>
    isPathWithinPrefix(pathname, rule.prefix),
  ) ?? null;
}

export function isPublicBetaRoleEnabled(role) {
  return role === 'player' || role === 'coach';
}

export function isPublicBetaPublicRoute(pathname) {
  return PUBLIC_BETA_PUBLIC_ROUTE_PREFIXES.some((prefix) =>
    isPathWithinPrefix(pathname, prefix),
  );
}
