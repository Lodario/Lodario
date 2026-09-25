'use client';

import { useState } from 'react';
import { Download, Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';

export function AccountPrivacyActions({ compact = false }: { compact?: boolean }) {
  const { session } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

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
        <Link
          href="/delete-account"
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[rgba(255,107,107,0.35)] bg-[rgba(255,107,107,0.08)] px-3 py-2 text-sm font-semibold text-[#ff8b8b] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 size={17} />
          Delete my account
        </Link>
      </div>

      {exportMessage ? <p role="status" className="mt-3 text-xs text-gray-300">{exportMessage}</p> : null}
    </section>
  );
}
