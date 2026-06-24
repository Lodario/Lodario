'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type BetaRole = 'Player' | 'Coach';

interface FormState {
  name: string;
  email: string;
  role: BetaRole | '';
  age: string;
  country: string;
  level: string;
  reason: string;
}

const initialFormState: FormState = {
  name: '',
  email: '',
  role: '',
  age: '',
  country: '',
  level: '',
  reason: '',
};

const successMessage = "Thanks — we’ll email you if you’re selected for the beta.";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function BetaSignupForm() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();

    if (!name) {
      setError('Please enter your name.');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!form.role) {
      setError('Please choose Player or Coach.');
      return;
    }

    setIsSubmitting(true);

    const { error: insertError } = await supabase
      .from('beta_waitlist')
      .insert({
        name,
        email,
        role: form.role,
        age: form.age.trim() || null,
        country: form.country.trim() || null,
        level: form.level.trim() || null,
        reason: form.reason.trim() || null,
      });

    setIsSubmitting(false);

    if (insertError && insertError.code !== '23505') {
      setError(insertError.message || 'Unable to join the beta right now. Please try again.');
      return;
    }

    setIsSubmitted(true);
    setForm(initialFormState);
  };

  if (isSubmitted) {
    return (
      <div className="rounded-2xl border border-[rgba(var(--status-green-rgb),0.35)] bg-[rgba(var(--status-green-rgb),0.1)] p-5 text-center shadow-lg">
        <CheckCircle2 className="mx-auto text-[var(--status-green)]" size={36} />
        <p className="mt-3 text-sm font-semibold text-white">{successMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[rgba(var(--surface-card-rgb),0.84)] p-4 shadow-2xl backdrop-blur-md sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required>
          <input
            type="text"
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            autoComplete="name"
            className="beta-input"
          />
        </Field>

        <Field label="Email" required>
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            autoComplete="email"
            className="beta-input"
          />
        </Field>

        <Field label="Role" required>
          <div className="grid grid-cols-2 gap-2">
            {(['Player', 'Coach'] as BetaRole[]).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => updateField('role', role)}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition-colors ${
                  form.role === role
                    ? 'border-[rgba(var(--accent-primary-rgb),0.65)] bg-[rgba(var(--accent-primary-rgb),0.16)] text-[var(--accent-primary)]'
                    : 'border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] text-gray-200 hover:border-[rgba(255,255,255,0.24)]'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Age">
          <input
            type="text"
            value={form.age}
            onChange={(event) => updateField('age', event.target.value)}
            inputMode="numeric"
            className="beta-input"
          />
        </Field>

        <Field label="Country">
          <input
            type="text"
            value={form.country}
            onChange={(event) => updateField('country', event.target.value)}
            autoComplete="country-name"
            className="beta-input"
          />
        </Field>

        <Field label="Level/team type">
          <input
            type="text"
            value={form.level}
            onChange={(event) => updateField('level', event.target.value)}
            className="beta-input"
          />
        </Field>

        <Field label="Reason for wanting to test Lodario" className="sm:col-span-2">
          <textarea
            value={form.reason}
            onChange={(event) => updateField('reason', event.target.value)}
            rows={4}
            className="beta-input resize-none"
          />
        </Field>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-[rgba(255,107,107,0.22)] bg-[rgba(255,107,107,0.1)] px-3 py-2 text-sm text-[var(--status-red)]">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-tertiary)] px-4 py-3.5 text-sm font-bold text-black shadow-lg shadow-[0_16px_40px_rgba(var(--accent-tertiary-rgb),0.22)] transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto sm:min-w-[190px]"
      >
        {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
        Join Beta
      </button>
    </form>
  );
}

function Field({
  children,
  label,
  required = false,
  className = '',
}: {
  children: React.ReactNode;
  label: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
        {required ? <span className="text-[var(--accent-primary)]"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
