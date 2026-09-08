'use client';

import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { CalendarDays, Loader2, ShieldCheck } from 'lucide-react';
import { AppLogo } from '@/components/AppLogo';
import { useAuth } from '@/lib/AuthContext';
import { PublicLegalLinks } from '@/components/legal/PublicLegalLinks';
import {
  confirmPublicBetaDateOfBirth,
  getPublicBetaAgeStatus,
  PublicBetaAgeStatus,
} from '@/lib/betaAge';

export function PublicBetaAgeGate({ children }: { children: React.ReactNode }) {
  const { user, userRole, signOut } = useAuth();
  const [status, setStatus] = useState<PublicBetaAgeStatus | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    if (!user || !userRole) return;

    setLoading(true);
    setError(null);
    const result = await getPublicBetaAgeStatus();
    setLoading(false);

    if (result.error || !result.data) {
      setError(result.error || 'Unable to verify beta eligibility.');
      return;
    }

    setStatus(result.data);
  }, [user, userRole]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!dateOfBirth) {
      setError('Enter your date of birth.');
      return;
    }

    setSaving(true);
    const result = await confirmPublicBetaDateOfBirth(dateOfBirth);
    setSaving(false);

    if (result.error || !result.data) {
      setError(result.error || 'Unable to save your date of birth.');
      return;
    }

    setStatus(result.data);
  };

  if (loading) {
    return <AgeGateFrame><Loader2 className="animate-spin text-[var(--accent-primary)]" size={36} /><p className="mt-4 text-sm text-gray-400">Checking beta eligibility…</p></AgeGateFrame>;
  }

  if (status?.eligible) {
    return <>{children}</>;
  }

  if (status?.hasDateOfBirth && status.age !== null && status.age < 18) {
    return (
      <AgeGateFrame>
        <ShieldCheck className="text-[var(--accent-primary)]" size={38} />
        <h1 className="mt-4 text-2xl font-bold text-white">Lodario 18+ beta</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-400">
          The current Lodario public beta is only available to people aged 18 or older.
        </p>
        <button type="button" onClick={signOut} className="mt-6 w-full rounded-xl border border-[var(--accent-primary)] px-4 py-3 text-sm font-bold text-[var(--accent-primary)]">
          Sign out
        </button>
      </AgeGateFrame>
    );
  }

  return (
    <AgeGateFrame>
      <CalendarDays className="text-[var(--accent-primary)]" size={38} />
      <h1 className="mt-4 text-2xl font-bold text-white">Confirm your age</h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-400">
        Lodario’s current public beta is for adults aged 18 or older. Enter your date of birth once so we can check eligibility.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 text-left">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">
          Date of birth
          <input
            required
            type="date"
            value={dateOfBirth}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) => {
              setDateOfBirth(event.target.value);
              setError(null);
            }}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-white [color-scheme:dark]"
          />
        </label>

        {error ? <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs leading-relaxed text-red-300">{error}</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-tertiary)] px-4 py-3 text-sm font-bold text-black disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : null}
          Continue
        </button>
      </form>

      <button type="button" onClick={signOut} className="mt-3 w-full px-4 py-2 text-sm font-semibold text-gray-400">
        Sign out
      </button>
    </AgeGateFrame>
  );
}

function AgeGateFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm text-center">
        <AppLogo size={64} priority className="mx-auto mb-5" />
        <div className="glass-card p-7 animate-slide-up">
          {children}
          <PublicLegalLinks className="mt-6 border-t border-white/10 pt-5" />
        </div>
      </div>
    </div>
  );
}
