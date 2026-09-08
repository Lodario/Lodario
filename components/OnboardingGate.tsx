'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useData } from '@/lib/DataContext';
import { Shield } from 'lucide-react';
import { OnboardingFlow } from './OnboardingFlow';
import { getPlayerAgeState, type PlayerAgeState } from '@/lib/guardian/onboarding';
import { PlayerAgeSetup } from '@/components/guardian/PlayerAgeSetup';
import { RestrictedPlayerPage } from '@/components/guardian/RestrictedPlayerPage';
import { PUBLIC_BETA_FEATURES } from '@/lib/betaScope.mjs';

interface OnboardingGateProps {
  children: React.ReactNode;
}

/**
 * Gates the main app behind the guided onboarding flow.
 *
 * A user is considered "onboarded" when their profile exists and
 * `onboardingCompleted` is true. Existing users were backfilled to true in
 * the migration, so this only intercepts new sign-ups.
 */
export function OnboardingGate({ children }: OnboardingGateProps) {
  const { profile, isLoading } = useData();
  const [ageState, setAgeState] = useState<PlayerAgeState | null>(null);
  const [ageLoading, setAgeLoading] = useState<boolean>(PUBLIC_BETA_FEATURES.guardianAndMinorAccounts);
  const [ageError, setAgeError] = useState<string | null>(null);
  const loadAgeState = useCallback(async () => {
    if (!PUBLIC_BETA_FEATURES.guardianAndMinorAccounts) {
      setAgeState(null);
      setAgeError(null);
      setAgeLoading(false);
      return;
    }

    setAgeLoading(true);
    const result = await getPlayerAgeState();
    setAgeState(result.data);
    setAgeError(result.error);
    setAgeLoading(false);
  }, []);
  useEffect(() => {
    if (PUBLIC_BETA_FEATURES.guardianAndMinorAccounts) {
      void loadAgeState();
    }
  }, [loadAgeState]);

  if (isLoading || (PUBLIC_BETA_FEATURES.guardianAndMinorAccounts && ageLoading)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)]">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-[var(--accent-primary)] border-t-transparent animate-spin" />
          <Shield className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[var(--accent-primary)]" size={24} />
        </div>
        <p className="mt-6 text-gray-400 text-sm font-medium animate-pulse">Loading your profile...</p>
      </div>
    );
  }

  if (PUBLIC_BETA_FEATURES.guardianAndMinorAccounts && ageError) {
    return <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4 text-white"><div className="glass-card max-w-md p-6"><h1 className="text-xl font-bold">Account setup unavailable</h1><p className="mt-2 text-sm text-gray-400">{ageError}</p><button onClick={loadAgeState} className="mt-5 rounded-xl bg-[var(--accent-primary)] px-5 py-3 font-bold text-black">Try again</button></div></div>;
  }

  if (PUBLIC_BETA_FEATURES.guardianAndMinorAccounts && !ageState?.hasAgeIdentity) {
    return <PlayerAgeSetup onComplete={state => { setAgeState(state); void loadAgeState(); }} />;
  }
  if (PUBLIC_BETA_FEATURES.guardianAndMinorAccounts && ageState?.restricted) {
    return <RestrictedPlayerPage state={ageState} onRefresh={loadAgeState} />;
  }

  // No profile row yet OR profile exists but onboarding flag is not set.
  if (!profile || !profile.onboardingCompleted) {
    return <OnboardingFlow />;
  }

  return <>{children}</>;
}
