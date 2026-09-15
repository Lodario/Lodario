import type { Metadata } from 'next';
import { PublicDocumentLayout } from '@/components/legal/PublicDocumentLayout';
import { SUPPORT_EMAIL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Support and Contact | Lodario',
  description: 'Contact Lodario about bugs, account access, privacy, data export, or account deletion.',
  alternates: { canonical: '/support' },
};

export default function SupportPage() {
  return (
    <PublicDocumentLayout
      title="Support and Contact"
      description="Get help with the Lodario public beta or submit an account and privacy request."
    >
      <section className="rounded-2xl border border-[rgba(var(--accent-secondary-rgb),0.3)] bg-[rgba(var(--accent-secondary-rgb),0.08)] p-5">
        <h2 className="text-xl font-bold text-white">Email support</h2>
        <a className="mt-2 inline-block break-all text-base font-semibold text-[var(--accent-secondary)] underline" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
      </section>

      <Section title="Report a bug">
        <p>
          Tell us what you were trying to do, the page or feature involved, what happened, what you expected, and whether it happens again. Include your device type, browser, approximate time, and a screenshot only when useful. Do not include unrelated personal information.
        </p>
      </Section>

      <Section title="Account-access help">
        <p>
          Use the password-reset option on the sign-in screen first. If you still cannot access your account, email from the address associated with the account where possible. We may ask for limited information to verify ownership, but we will never ask you to send your password.
        </p>
      </Section>

      <Section title="Privacy, export, correction and deletion">
        <p>
          Signed-in users can download their data or delete their account from Player Profile or Coach Settings. Email support with the subject “Privacy request”, “Data export”, “Correction request”, or “Account deletion failure” if a self-service action fails. Include the displayed request ID, but do not include exported data, passwords, tokens, or health details. Identity verification may be required before account information is disclosed or changed.
        </p>
      </Section>

      <Section title="Security and abuse reports">
        <p>
          Use the subject “Security report” or “Abuse report”. Describe the affected feature, approximate time, and safe reproduction steps. Do not test against another person’s account or send credentials, access tokens, private health records, or exploit payloads containing real data.
        </p>
      </Section>

      <Section title="Please protect sensitive information">
        <p>
          Never email a password, authentication token, payment information, government identifier, or highly sensitive health or injury details. Send only the minimum information needed to explain the problem. If there is an urgent medical or safety concern, contact an appropriate professional or emergency service instead of Lodario support.
        </p>
      </Section>
    </PublicDocumentLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="mb-2 text-xl font-bold text-white">{title}</h2>{children}</section>;
}
