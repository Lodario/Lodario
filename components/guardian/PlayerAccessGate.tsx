'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getPlayerAgeState, type PlayerAgeState } from '@/lib/guardian/onboarding';
import { PlayerAgeSetup } from './PlayerAgeSetup';
import { RestrictedPlayerPage } from './RestrictedPlayerPage';
import { AccountPrivacyActions } from '@/components/AccountPrivacyActions';
import { PublicLegalLinks } from '@/components/legal/PublicLegalLinks';

/** Country and Guardian setup runs before consent and all sporting-data providers. */
export function PlayerAccessGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<PlayerAgeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await getPlayerAgeState();
    setState(result.data);
    setError(result.error || (!result.data ? 'Account eligibility could not be checked.' : null));
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh, user?.id]);

  if (loading) return <div className="flex min-h-screen items-center justify-center gap-3"><Loader2 className="animate-spin" />Checking account access…</div>;
  if (error) return <div className="mx-auto max-w-md space-y-4 p-6"><h1 className="text-xl font-bold">Account setup unavailable</h1><p role="alert">{error}</p><button onClick={() => void refresh()} className="min-h-11 rounded-xl bg-[var(--accent-primary)] px-5 font-bold text-black">Try again</button><PublicLegalLinks /><AccountPrivacyActions compact /></div>;
  if (!state?.hasAgeIdentity) return <PlayerAgeSetup onComplete={() => void refresh()} />;
  if (state.restricted || (state.guardianConnectionRequired && !state.hasGuardianConnection)) {
    return <RestrictedPlayerPage state={state} onRefresh={() => void refresh()} />;
  }
  return <>{children}</>;
}
