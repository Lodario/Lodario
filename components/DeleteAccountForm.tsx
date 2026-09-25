'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Loader2, LockKeyhole, Trash2, X } from 'lucide-react';
import { AppLogo } from '@/components/AppLogo';
import { PublicLegalLinks } from '@/components/legal/PublicLegalLinks';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

const DEFAULT_SUBJECT = 'Request for Account and Data Deletion';
const DELETE_CONFIRMATION = 'DELETE MY LODARIO ACCOUNT';
const ACCOUNT_EMAIL_ERROR = 'Please enter the email associated with your Lodario account or check the email for spelling errors.';
const MESSAGE_PLACEHOLDER = 'Please briefly explain why you are deleting your account. If you have any feedback about bugs, missing features, or anything we could improve, we would greatly appreciate it.';

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function DeleteAccountForm() {
  const { user, session, userRole, signIn, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  const validateForm = () => {
    const normalizedEmail = normalizeEmail(email);
    if (!isEmail(normalizedEmail)) {
      setEmailError(ACCOUNT_EMAIL_ERROR);
      return false;
    }
    if (user?.email && normalizedEmail !== normalizeEmail(user.email)) {
      setEmailError(ACCOUNT_EMAIL_ERROR);
      return false;
    }
    if (!subject.trim()) {
      setFormError('Enter a subject for your deletion request.');
      return false;
    }
    setEmailError(null);
    setFormError(null);
    return true;
  };

  const openConfirmation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) return;
    setPassword('');
    setShowConfirmation(true);
  };

  const submitDeletion = async () => {
    if (!validateForm()) {
      setShowConfirmation(false);
      return;
    }

    setDeleting(true);
    setFormError(null);

    try {
      let accessToken = session?.access_token ?? null;

      if (!accessToken) {
        if (!password) {
          setFormError('Enter your password to verify that this Lodario account belongs to you.');
          setDeleting(false);
          return;
        }

        const signInResult = await signIn(normalizeEmail(email), password);
        if (signInResult.error) {
          setEmailError(ACCOUNT_EMAIL_ERROR);
          setFormError('We could not verify this account. Check the email and password, then try again.');
          setDeleting(false);
          return;
        }

        const { data: { session: verifiedSession } } = await supabase.auth.getSession();
        accessToken = verifiedSession?.access_token ?? null;
      }

      if (!accessToken) {
        throw new Error('Authentication could not be verified. Please sign in and try again.');
      }

      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirmation: DELETE_CONFIRMATION,
          email: normalizeEmail(email),
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.deleted !== true) {
        if (result?.code === 'account_email_mismatch') setEmailError(ACCOUNT_EMAIL_ERROR);
        throw new Error(result?.error || 'Account deletion could not be completed.');
      }

      setShowConfirmation(false);
      setComplete(true);
      try {
        await signOut();
      } catch {
        // The server has already deleted the Auth user. The local session will expire.
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Account deletion could not be completed.');
    } finally {
      setDeleting(false);
    }
  };

  if (complete) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-4 py-8 sm:px-6">
        <div className="mx-auto w-full max-w-xl">
          <header className="mb-6">
            <Link href="/" aria-label="Lodario home" className="inline-flex items-center gap-3">
              <AppLogo size={48} priority />
              <span className="text-lg font-bold text-white">Lodario</span>
            </Link>
          </header>
          <section className="glass-card p-6 text-center sm:p-8" role="status">
            <CheckCircle2 className="mx-auto text-[var(--status-green)]" size={48} />
            <h1 className="mt-4 text-2xl font-bold text-white">Account and data deleted</h1>
            <p className="mt-3 text-sm leading-6 text-gray-300">
              Your Lodario account deletion completed successfully. Your request and any feedback were sent to Lodario support.
            </p>
            <Link href="/" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-semibold text-white hover:bg-white/[0.05]">
              Return to Lodario
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const signedInEmail = user?.email ? normalizeEmail(user.email) : null;

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6">
          <Link href={!user ? '/' : userRole === 'coach' ? '/coach/settings' : userRole === 'guardian' ? '/guardian/settings' : '/profile'} aria-label="Back to Lodario" className="inline-flex items-center gap-3">
            <AppLogo size={48} priority />
            <span className="text-lg font-bold text-white">Lodario</span>
          </Link>
        </header>

        <section className="glass-card p-5 sm:p-8">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[rgba(255,107,107,0.35)] bg-[rgba(255,107,107,0.1)]">
              <Trash2 className="text-[#ff8b8b]" size={21} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ff8b8b]">Account privacy</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">Delete Account and Data</h1>
              <p className="mt-2 text-sm leading-6 text-gray-400">
                Submit an optional explanation, then confirm permanent deletion. Nothing is deleted before confirmation.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-[rgba(255,107,107,0.25)] bg-[rgba(255,107,107,0.07)] p-4 text-xs leading-5 text-gray-300">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 shrink-0 text-[#ff8b8b]" size={17} />
              <p>
                Deletion is permanent and removes the account data covered by Lodario&apos;s deletion process. Coach deletion remains blocked while an owned team contains another member; Player-owned health data is never deleted with a Coach account.
              </p>
            </div>
          </div>

          <form onSubmit={openConfirmation} className="mt-6 space-y-5" noValidate>
            <div>
              <label htmlFor="delete-account-email" className="mb-1.5 block text-xs font-semibold text-gray-300">
                Account Email <span className="text-[#ff8b8b]">*</span>
              </label>
              <input
                id="delete-account-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setEmailError(null);
                }}
                aria-invalid={emailError ? 'true' : 'false'}
                aria-describedby={emailError ? 'delete-account-email-error' : 'delete-account-email-help'}
                className={`w-full rounded-xl border bg-white/[0.04] px-3 py-3 text-sm text-white outline-none transition-colors ${emailError ? 'border-[#ff6b6b] focus:border-[#ff6b6b] focus:ring-1 focus:ring-[#ff6b6b]' : 'border-white/15 focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]'}`}
              />
              {emailError ? (
                <p id="delete-account-email-error" role="alert" className="mt-2 text-xs leading-5 text-[#ff8b8b]">{emailError}</p>
              ) : (
                <p id="delete-account-email-help" className="mt-2 text-xs text-gray-500">
                  {signedInEmail ? 'This must match the email on your signed-in Lodario account.' : 'You will verify ownership securely before deletion can continue.'}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="delete-account-subject" className="mb-1.5 block text-xs font-semibold text-gray-300">Subject</label>
              <input
                id="delete-account-subject"
                type="text"
                required
                maxLength={120}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none transition-colors focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            </div>

            <div>
              <label htmlFor="delete-account-message" className="mb-1.5 block text-xs font-semibold text-gray-300">Message / Feedback <span className="font-normal text-gray-500">(optional)</span></label>
              <textarea
                id="delete-account-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={4000}
                rows={7}
                placeholder={MESSAGE_PLACEHOLDER}
                className="w-full resize-y rounded-xl border border-white/15 bg-white/[0.04] px-3 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-gray-600 focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            </div>

            {formError && !showConfirmation ? (
              <p role="alert" className="rounded-xl border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.08)] p-3 text-xs leading-5 text-[#ff8b8b]">
                {formError} <Link href="/support" className="font-semibold underline">Contact support</Link>
              </p>
            ) : null}

            <button
              type="submit"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#ff6b6b] px-4 py-3 text-sm font-bold text-black transition-colors hover:bg-[#ff7d7d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 size={18} />
              Send &amp; Delete All Account Data
            </button>
          </form>
        </section>

        <footer className="py-7"><PublicLegalLinks /></footer>
      </div>

      {showConfirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setShowConfirmation(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="delete-confirmation-title" className="w-full max-w-sm rounded-2xl border border-[rgba(255,107,107,0.35)] bg-[#181817] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 shrink-0 text-[#ff8b8b]" size={21} />
                <div>
                  <h2 id="delete-confirmation-title" className="text-lg font-bold text-white">Confirm Account &amp; Data Deletion</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-300">This deletion is permanent and cannot be undone.</p>
                </div>
              </div>
              <button type="button" disabled={deleting} onClick={() => setShowConfirmation(false)} className="rounded-lg p-1 text-gray-400 hover:text-white disabled:opacity-50" aria-label="Cancel account deletion">
                <X size={18} />
              </button>
            </div>

            {!session ? (
              <div className="mt-4">
                <label htmlFor="delete-account-password" className="mb-1.5 block text-xs font-semibold text-gray-300">Password</label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={17} />
                  <input
                    id="delete-account-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/20 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-[#ff8b8b]"
                  />
                </div>
                <p className="mt-2 text-xs leading-5 text-gray-400">Enter your password to verify ownership of the account before deletion.</p>
              </div>
            ) : null}

            {formError ? <p role="alert" className="mt-3 text-xs leading-5 text-[#ff8b8b]">{formError}</p> : null}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" disabled={deleting} onClick={() => setShowConfirmation(false)} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm font-semibold text-white hover:bg-white/[0.05] disabled:opacity-50">Cancel</button>
              <button type="button" disabled={deleting} onClick={() => void submitDeletion()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#ff6b6b] px-4 text-sm font-bold text-black hover:bg-[#ff7d7d] disabled:cursor-not-allowed disabled:opacity-60">
                {deleting ? <Loader2 className="animate-spin" size={17} /> : null}
                {deleting ? 'Deleting…' : 'Confirm'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
