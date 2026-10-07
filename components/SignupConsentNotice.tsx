'use client';

import Link from 'next/link';
import { MARKETING_EMAIL_CONSENT_TEXT } from '@/lib/signup-consent';

export function SignupConsentNotice({ marketingEmails, onMarketingChange, disabled = false }: {
  marketingEmails: boolean;
  onMarketingChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs leading-5 text-gray-400">
        By clicking Create Account, you agree to the <Link href="/terms" target="_blank" className="font-semibold text-[var(--accent-secondary)] underline">Terms of Use</Link> and acknowledge the <Link href="/privacy" target="_blank" className="font-semibold text-[var(--accent-secondary)] underline">Privacy Policy</Link>.
      </p>
      <label htmlFor="auth-marketing-emails" className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <input id="auth-marketing-emails" type="checkbox" checked={marketingEmails} disabled={disabled}
          onChange={(event) => onMarketingChange(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent-primary)]" />
        <span className="text-xs leading-5 text-gray-300">
          <span className="mb-1 block font-semibold text-white">Marketing emails <span className="font-normal text-gray-500">(optional)</span></span>
          {MARKETING_EMAIL_CONSENT_TEXT}
        </span>
      </label>
    </div>
  );
}
