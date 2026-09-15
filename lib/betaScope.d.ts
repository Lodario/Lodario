export interface PublicBetaFeatures {
  readonly aiAssistant: false;
  readonly guardianAndMinorAccounts: true;
  readonly subscriptionsAndPayments: false;
  readonly advertising: false;
  readonly healthIntegrations: false;
  readonly unfinishedFeatures: false;
}

export interface PublicBetaDisabledRouteRule {
  readonly prefix: string;
  readonly kind: 'api' | 'page';
  readonly redirectTo: string | null;
}

export const PUBLIC_BETA_FEATURES: PublicBetaFeatures;
export const PUBLIC_BETA_DISABLED_ROUTE_RULES: readonly PublicBetaDisabledRouteRule[];
export const PUBLIC_BETA_UNAVAILABLE_MESSAGE: string;
export const PUBLIC_BETA_PUBLIC_ROUTE_PREFIXES: readonly string[];

export function getPublicBetaDisabledRouteRule(pathname: string): PublicBetaDisabledRouteRule | null;
export function isPublicBetaRoleEnabled(role: unknown): role is 'player' | 'coach' | 'guardian';
export function isPublicBetaPublicRoute(pathname: string): boolean;
