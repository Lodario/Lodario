import type { Metadata } from 'next';
import { AppLogo } from '@/components/AppLogo';
import { BetaSignupForm } from './BetaSignupForm';

export const metadata: Metadata = {
  title: 'Join the Lodario Beta',
  description: 'Lodario helps football players and coaches track wellness, training load, readiness, and schedules.',
};

export default function BetaPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col justify-center gap-8">
        <header className="max-w-3xl">
          <AppLogo size={64} priority className="mb-5 shadow-lg shadow-[0_16px_40px_rgba(var(--accent-tertiary-rgb),0.22)]" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-secondary)]">Lodario Beta</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">Join the Lodario Beta</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-gray-300">
            Lodario helps football players and coaches track wellness, training load, readiness, and schedules.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,1fr)] lg:items-start">
          <div className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] p-5">
            <dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <BetaSignal label="Players" value="Wellness and readiness" />
              <BetaSignal label="Coaches" value="Team load and schedules" />
              <BetaSignal label="Testing" value="Early product access" />
            </dl>
          </div>
          <BetaSignupForm />
        </section>
      </div>
    </main>
  );
}

function BetaSignal({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-white">{value}</dd>
    </div>
  );
}
