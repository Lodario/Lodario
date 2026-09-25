export const PUBLIC_BETA_FEATURES = Object.freeze({
  aiAssistant: false,
  guardianAndMinorAccounts: true,
  subscriptionsAndPayments: false,
  advertising: false,
  healthIntegrations: false,
  unfinishedFeatures: false,
});

export const PUBLIC_BETA_DISABLED_ROUTE_RULES = Object.freeze([]);

export const PUBLIC_BETA_UNAVAILABLE_MESSAGE =
  'This feature is not available in the Lodario public beta.';

export const PUBLIC_BETA_PUBLIC_ROUTE_PREFIXES = Object.freeze([
  '/beta',
  '/reset-password',
  '/privacy',
  '/terms',
  '/health-disclaimer',
  '/cookies',
  '/support',
  '/delete-account',
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
  return role === 'player' || role === 'coach' || role === 'guardian';
}

export function isPublicBetaPublicRoute(pathname) {
  return PUBLIC_BETA_PUBLIC_ROUTE_PREFIXES.some((prefix) =>
    isPathWithinPrefix(pathname, prefix),
  );
}
