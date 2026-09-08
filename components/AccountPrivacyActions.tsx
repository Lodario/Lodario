'use client';

import { useState } from 'react';
import { AlertTriangle, Download, Loader2, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';

const DELETE_CONFIRMATION = 'DELETE MY LODARIO ACCOUNT';

export function AccountPrivacyActions({ compact = false }: { compact?: boolean }) {
  const { session, signOut, userRole } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [showDeletion, setShowDeletion] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deletionError, setDeletionError] = useState<string | null>(null);

  const authenticatedFetch = (input: string, init: RequestInit) => fetch(input, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  });

  const downloadExport = async () => {
    setExporting(true);
    setExportMessage(null);
    try {
      const response = await authenticatedFetch('/api/account/export', { method: 'POST' });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || 'Your export could not be generated.');
      }
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') ?? '';
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'lodario-data-export.json';
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setExportMessage('Your Lodario data export was downloaded.');
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : 'Your export could not be generated.');
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    if (confirmation !== DELETE_CONFIRMATION) return;
    setDeleting(true);
    setDeletionError(null);
    try {
      const response = await authenticatedFetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.deleted !== true) {
        throw new Error(result?.error || 'Account deletion could not be completed.');
      }
      await signOut();
      window.location.assign('/');
    } catch (error) {
      setDeletionError(error instanceof Error ? error.message : 'Account deletion could not be completed.');
      setDeleting(false);
    }
  };

  return (
    <section className={compact ? 'space-y-3' : 'rounded-xl border border-white/10 bg-white/[0.03] p-4'}>
      {!compact ? (
        <>
          <h3 className="text-sm font-semibold text-white">Your data and account</h3>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">
            Download an owner-scoped copy of your Lodario data or permanently delete your account.
          </p>
        </>
      ) : null}

      <div className={`${compact ? '' : 'mt-4'} grid gap-2 sm:grid-cols-2`}>
        <button
          type="button"
          onClick={() => void downloadExport()}
          disabled={exporting || !session}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[rgba(var(--accent-secondary-rgb),0.35)] bg-[rgba(var(--accent-secondary-rgb),0.1)] px-3 py-2 text-sm font-semibold text-[var(--accent-secondary)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {exporting ? <Loader2 className="animate-spin" size={17} /> : <Download size={17} />}
          {exporting ? 'Preparing…' : 'Download my data'}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowDeletion(true);
            setDeletionError(null);
          }}
          disabled={!session}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[rgba(255,107,107,0.35)] bg-[rgba(255,107,107,0.08)] px-3 py-2 text-sm font-semibold text-[#ff8b8b] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 size={17} />
          Delete my account
        </button>
      </div>

      {exportMessage ? <p role="status" className="mt-3 text-xs text-gray-300">{exportMessage}</p> : null}

      {showDeletion ? (
        <div className="mt-4 rounded-xl border border-[rgba(255,107,107,0.35)] bg-[rgba(255,107,107,0.08)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 shrink-0 text-[#ff8b8b]" size={18} />
              <div>
                <h4 className="text-sm font-semibold text-white">Permanently delete this account?</h4>
                <p className="mt-1 text-xs leading-relaxed text-gray-300">
                  Your account, profile, logs, injuries, calendar records, memberships, consent history, and inactive Guardian links will be deleted. Limited anonymous operational counts and provider backups may remain temporarily under the documented retention process.
                </p>
                {userRole === 'coach' ? (
                  <p className="mt-2 text-xs leading-relaxed text-amber-200">
                    Deletion is blocked if a team you own contains another member. Transfer or close those teams through support first; Player-owned health logs are never deleted with a Coach account.
                  </p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowDeletion(false);
                setConfirmation('');
                setDeletionError(null);
              }}
              className="rounded-lg p-1 text-gray-400 hover:text-white"
              aria-label="Cancel account deletion"
            >
              <X size={18} />
            </button>
          </div>

          <label htmlFor="account-delete-confirmation" className="mt-4 block text-xs font-medium text-gray-300">
            Type <span className="font-mono text-white">{DELETE_CONFIRMATION}</span>
          </label>
          <input
            id="account-delete-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-sm text-white outline-none focus:border-[#ff8b8b]"
          />
          <p className="mt-2 text-xs text-gray-400">
            You must have signed in within the last 15 minutes. You can cancel until you press the final button.
          </p>
          {deletionError ? (
            <p role="alert" className="mt-3 text-xs text-[#ff8b8b]">
              {deletionError}{' '}
              <Link href="/support" className="underline">Contact support</Link>
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void deleteAccount()}
            disabled={deleting || confirmation !== DELETE_CONFIRMATION}
            className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#ff6b6b] px-3 py-2 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? <Loader2 className="animate-spin" size={17} /> : <Trash2 size={17} />}
            {deleting ? 'Deleting…' : 'Permanently delete account'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
