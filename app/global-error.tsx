'use client';

import { useEffect, useState } from 'react';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [requestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    console.error(`[global_app_error] request_id=${requestId}`);
  }, [requestId]);

  return (
    <html lang="en">
      <body className="bg-[#0b0f14] text-white">
        <main className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
            <h1 className="text-xl font-bold">Lodario is temporarily unavailable</h1>
            <p className="mt-3 text-sm text-gray-300">
              Retry once. If the problem continues, contact contact.lodario@gmail.com and include only this request ID.
            </p>
            <p className="mt-3 font-mono text-xs text-gray-500">Request ID: {requestId}</p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 w-full rounded-xl bg-[#22c55e] px-4 py-3 text-sm font-bold text-black"
            >
              Retry
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
