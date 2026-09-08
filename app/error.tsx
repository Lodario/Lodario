'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [requestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    console.error(`[app_error] request_id=${requestId}`);
  }, [requestId]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6 text-white">
      <div className="glass-card w-full max-w-md p-6 text-center">
        <h1 className="text-xl font-bold">Lodario could not open this view</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-300">
          Your private inputs were not included in this message. Retry once, then contact support with the request ID if the problem continues.
        </p>
        <p className="mt-3 font-mono text-xs text-gray-500">Request ID: {requestId}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-[var(--accent-primary)] px-4 py-3 text-sm font-bold text-black"
          >
            Retry
          </button>
          <Link
            href="/support"
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold"
          >
            Open support
          </Link>
        </div>
      </div>
    </main>
  );
}
