'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { DataProvider } from '@/lib/DataContext';
import { BottomNav } from '@/components/BottomNav';
import { OfflineBanner } from '@/components/OfflineBanner';
import { OnboardingGate } from '@/components/OnboardingGate';
import { PublicBetaAgeGate } from '@/components/PublicBetaAgeGate';
import { RequiredConsentGate } from '@/components/RequiredConsentGate';
import { PlayerAccessGate } from '@/components/guardian/PlayerAccessGate';
import { isCoachRoute, isGuardianRoute } from '@/lib/routeRoles';
import {
  getPublicBetaDisabledRouteRule,
  isPublicBetaPublicRoute,
  PUBLIC_BETA_FEATURES,
} from '@/lib/betaScope.mjs';

interface RootAppShellProps {
  children: React.ReactNode;
}

export function RootAppShell({ children }: RootAppShellProps) {
  const pathname = usePathname();
  const disabledRoute = getPublicBetaDisabledRouteRule(pathname);
  const publicRoute = isPublicBetaPublicRoute(pathname)
    || (PUBLIC_BETA_FEATURES.guardianAndMinorAccounts && pathname.startsWith('/guardian/invite/'));
  const coachRoute = isCoachRoute(pathname);
  const guardianRoute = isGuardianRoute(pathname);

  if (disabledRoute) {
    return null;
  }

  if (publicRoute) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        {children}
      </div>
    );
  }

  if (coachRoute) {
    return (
      <AuthGate requiredRole="coach">
        <PublicBetaAgeGate>
          <RequiredConsentGate>
            <div className="min-h-screen bg-[var(--background)]">
              {children}
            </div>
          </RequiredConsentGate>
        </PublicBetaAgeGate>
      </AuthGate>
    );
  }

  if (guardianRoute && PUBLIC_BETA_FEATURES.guardianAndMinorAccounts) {
    return (
      <AuthGate requiredRole="guardian">
        <RequiredConsentGate>
        <div className="min-h-screen bg-[var(--background)]">
          {children}
        </div>
        </RequiredConsentGate>
      </AuthGate>
    );
  }

  return (
    <AuthGate requiredRole="player">
      <PlayerAccessGate>
        <RequiredConsentGate>
          <DataProvider>
            <OnboardingGate>
              <div className="player-app-shell max-w-md mx-auto min-h-screen relative shadow-2xl bg-[var(--background)] overflow-hidden flex flex-col">
                <OfflineBanner />
                <main className="flex-1 overflow-y-auto pb-24">
                  {children}
                </main>
                <BottomNav />
              </div>
            </OnboardingGate>
          </DataProvider>
        </RequiredConsentGate>
      </PlayerAccessGate>
    </AuthGate>
  );
}
