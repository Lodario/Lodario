'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { REQUIRED_CONSENT_DOCUMENTS, SUPPORT_EMAIL } from '@/lib/legal';
import { AccountPrivacyActions } from '@/components/AccountPrivacyActions';

type ConsentDocument = {
  documentType: string;
  documentVersion: string;
  documentUrl: string;
  label: string;
  required: boolean;
  accepted: boolean;
  acceptedAt: string | null;
};

type ConsentStatus = {
  complete: boolean;
  guardianAcceptanceRequired?: boolean;
  documents: ConsentDocument[];
};

function fallbackDocuments(): ConsentDocument[] {
  return REQUIRED_CONSENT_DOCUMENTS.map((document) => ({
    ...document,
    required: true,
    accepted: false,
    acceptedAt: null,
  }));
}

export function RequiredConsentGate({ children, playerId }: { children: React.ReactNode; playerId?: string }) {
  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: statusError } = await supabase.rpc(
      playerId ? 'guardian_get_player_consent_status' : 'public_beta_get_my_consent_status',
      playerId ? { p_player_id: playerId } : undefined,
    );
    if (
      statusError
      || !data
      || typeof data !== 'object'
      || Array.isArray(data)
      || !Array.isArray(data.documents)
    ) {
      setStatus({ complete: false, documents: fallbackDocuments() });
      setError('Consent status is unavailable. Core data processing remains paused.');
      setLoading(false);
      return;
    }
    setStatus(data as ConsentStatus);
    setLoading(false);
  }, [playerId]);

  useEffect(() => {
    setChecked({});
    setDeclined(false);
    void loadStatus();
  }, [loadStatus]);

  const documents = status?.documents ?? fallbackDocuments();
  const allChecked = useMemo(
    () => documents.every((document) => checked[document.documentType] === true),
    [checked, documents],
  );

  const accept = async () => {
    if (!allChecked) return;
    setSaving(true);
    setError(null);
    const acceptances = Object.fromEntries(
      documents.map((document) => [document.documentType, document.documentVersion]),
    );
    const { data, error: acceptanceError } = await supabase.rpc(
      playerId ? 'guardian_accept_player_documents' : 'public_beta_accept_required_consents',
      { p_acceptances: acceptances, ...(playerId ? { p_player_id: playerId } : {}) },
    );
    if (
      acceptanceError
      || !data
      || typeof data !== 'object'
      || Array.isArray(data)
      || data.complete !== true
    ) {
      setError('Acceptance could not be recorded securely. Nothing was accepted; please retry.');
      setSaving(false);
      return;
    }
    setStatus(data as ConsentStatus);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6 text-gray-300">
        <Loader2 className="mr-2 animate-spin" size={20} /> Checking required documents…
      </div>
    );
  }

  if (status?.complete) return <>{children}</>;

  if (!playerId && status?.guardianAcceptanceRequired) return (
    <div className="mx-auto max-w-lg space-y-5 p-6">
      <h1 className="text-2xl font-bold">Your Guardian needs to review the documents</h1>
      <p className="text-sm text-gray-300">Ask your connected Guardian to open your Player page in their workspace and accept the current documents. Your training and wellness access will resume after their approval is recorded.</p>
      <button onClick={() => void loadStatus()} className="min-h-11 rounded-xl bg-[var(--accent-primary)] px-5 font-bold text-black">Check approval status</button>
      <Link href="/support" className="block underline">Contact support</Link>
      <AccountPrivacyActions compact />
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-8 text-white">
      <div className="mx-auto max-w-xl">
        <div className="glass-card p-6">
          <div className="flex items-start gap-3">
            {declined ? (
              <AlertTriangle className="mt-0.5 shrink-0 text-amber-300" size={23} />
            ) : (
              <ShieldCheck className="mt-0.5 shrink-0 text-[var(--accent-primary)]" size={23} />
            )}
            <div>
              <h1 className="text-xl font-bold">
                {declined ? 'Required processing remains paused' : playerId ? 'Review documents for this Player' : 'Review and accept the current documents'}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">
                Lodario needs a server-recorded acceptance of each current document before processing wellness, training, injury, calendar, or Coach-sharing data. Checkboxes are intentionally not preselected.
              </p>
            </div>
          </div>

          {!declined ? (
            <div className="mt-6 space-y-3">
              {documents.map((document) => (
                <label
                  key={document.documentType}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <input
                    type="checkbox"
                    checked={checked[document.documentType] === true}
                    onChange={(event) => setChecked((current) => ({
                      ...current,
                      [document.documentType]: event.target.checked,
                    }))}
                    className="mt-1 h-4 w-4 accent-[var(--accent-primary)]"
                  />
                  <span className="text-sm leading-relaxed text-gray-200">
                    {playerId ? 'As this Player’s authorised Guardian, I have read and accept the ' : 'I have read and accept the '}
                    <Link
                      href={document.documentUrl}
                      target="_blank"
                      className="font-semibold text-[var(--accent-secondary)] underline"
                    >
                      {document.label}
                    </Link>
                    <span className="mt-1 block font-mono text-[10px] text-gray-500">
                      {document.documentVersion}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-amber-300/25 bg-amber-300/5 p-4 text-sm leading-relaxed text-gray-300">
              You may still read the public documents, contact support, download existing account data, or delete your account. Return to this screen and accept later if you want to use the core beta.
            </div>
          )}

          {error ? <p role="alert" className="mt-4 text-sm text-[#ff8b8b]">{error}</p> : null}

          {!declined ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void accept()}
                disabled={!allChecked || saving || Boolean(error)}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-tertiary)] px-4 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                {saving ? 'Recording…' : 'Accept required documents'}
              </button>
              <button
                type="button"
                onClick={() => setDeclined(true)}
                className="min-h-12 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-gray-200"
              >
                Decline for now
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDeclined(false);
                setChecked({});
              }}
              className="mt-5 min-h-11 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold"
            >
              Return to document acceptance
            </button>
          )}

          {error ? (
            <button
              type="button"
              onClick={() => void loadStatus()}
              className="mt-3 min-h-10 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold"
            >
              Retry secure status check
            </button>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 border-t border-white/10 pt-4 text-xs">
            <Link href="/privacy" className="text-[var(--accent-secondary)] underline">Privacy Policy</Link>
            <Link href="/terms" className="text-[var(--accent-secondary)] underline">Terms</Link>
            <Link href="/health-disclaimer" className="text-[var(--accent-secondary)] underline">Health disclaimer</Link>
            <Link href="/support" className="text-[var(--accent-secondary)] underline">Support</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[var(--accent-secondary)] underline">{SUPPORT_EMAIL}</a>
          </div>
        </div>

        {!playerId ? <div className="glass-card mt-4 p-5">
          <AccountPrivacyActions compact />
        </div> : null}
      </div>
    </div>
  );
}
