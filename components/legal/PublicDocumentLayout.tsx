import Link from 'next/link';
import { AppLogo } from '@/components/AppLogo';
import { PublicLegalLinks } from '@/components/legal/PublicLegalLinks';
import { LEGAL_DOCUMENT_VERSION, LEGAL_EFFECTIVE_DATE } from '@/lib/legal';

export function PublicDocumentLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6">
          <Link href="/beta" aria-label="Lodario beta home" className="inline-flex items-center gap-3">
            <AppLogo size={48} priority />
            <span className="text-lg font-bold text-white">Lodario</span>
          </Link>
        </header>

        <article className="glass-card p-5 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-secondary)]">
            Public beta
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-gray-300">{description}</p>
          <p className="mt-4 text-xs text-gray-500">
            Effective {LEGAL_EFFECTIVE_DATE} · Version {LEGAL_DOCUMENT_VERSION}
          </p>

          <div className="legal-document mt-8 space-y-7 text-sm leading-7 text-gray-300">
            {children}
          </div>
        </article>

        <footer className="py-7">
          <PublicLegalLinks />
        </footer>
      </div>
    </main>
  );
}
