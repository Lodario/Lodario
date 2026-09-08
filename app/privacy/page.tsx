import type { Metadata } from 'next';
import { PublicDocumentLayout } from '@/components/legal/PublicDocumentLayout';
import { getLegalOperatorName, LEGAL_OPERATOR_PLACEHOLDER } from '@/lib/env/server';
import { REQUIRED_CONSENT_DOCUMENTS, SUPPORT_EMAIL } from '@/lib/legal';

const privacyVersion = REQUIRED_CONSENT_DOCUMENTS.find((document) => document.documentType === 'privacy_policy')!.documentVersion;
const healthDataVersion = REQUIRED_CONSENT_DOCUMENTS.find((document) => document.documentType === 'health_data_processing')!.documentVersion;
const coachSharingVersion = REQUIRED_CONSENT_DOCUMENTS.find((document) => document.documentType === 'coach_player_data_sharing')!.documentVersion;

export const metadata: Metadata = {
  title: 'Privacy Policy | Lodario',
  description: 'How Lodario handles personal, training, wellness, team, calendar, and support information during the 18+ public beta.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  const operatorName = getLegalOperatorName();
  const operatorMissing = operatorName === LEGAL_OPERATOR_PLACEHOLDER;

  return (
    <PublicDocumentLayout
      title="Privacy Policy"
      description="This policy explains what Lodario currently collects, why it is used, who can see it, and how to make a privacy request."
    >
      <Section title="Who operates Lodario">
        <p>
          Lodario is operated by <strong className={operatorMissing ? 'text-amber-300' : 'text-white'}>{operatorName}</strong>.
          {operatorMissing ? ' This launch detail must be configured before public deployment.' : ''}
          {' '}Privacy questions can be sent to <EmailLink />.
        </p>
      </Section>

      <Section title="Versioned acceptance">
        <p>
          The current Privacy Policy acceptance identifier is <code>{privacyVersion}</code>. Required health-data processing uses <code>{healthDataVersion}</code>, and Coach access and Player-data sharing uses <code>{coachSharingVersion}</code>. Lodario records the signed-in user, exact identifier, and server-generated acceptance time. A new identifier requires renewed acceptance.
        </p>
      </Section>

      <Section title="Information we handle and why">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-white">Account and profile:</strong> email address, authentication identifiers, name, role, date of birth, physical and football profile details, availability, training resources, and onboarding status. We use these to secure accounts, enforce the 18+ beta restriction, personalise the product, and provide role-appropriate features. Password authentication is handled by Supabase; Lodario does not receive your password in readable form.</li>
          <li><strong className="text-white">Age and country:</strong> date of birth is used to calculate eligibility for the current 18+ beta. Country fields may remain in the inactive guardian/minor data model, but country is not currently used for the public beta age decision.</li>
          <li><strong className="text-white">Teams and connections:</strong> team details, team codes, memberships, and coach-player relationships are used to connect accounts and provide team workspaces.</li>
          <li><strong className="text-white">Training and wellness:</strong> wellness check-ins, training logs, readiness and load results, recommendations, pain reports, and injury status are used to show trends and informational training guidance. This can include sensitive health-related information.</li>
          <li><strong className="text-white">Calendar and attendance:</strong> individual and team events, recurring schedules, RSVP responses, attendance, and display preferences are used to run calendars and team participation features.</li>
          <li><strong className="text-white">Feedback and support:</strong> the email, title, description, page context, account role, time, browser user agent, and timezone supplied or attached to a feedback request are used to investigate and respond to it.</li>
          <li><strong className="text-white">Policy records:</strong> required document type, exact version, and server-generated acceptance time are retained with the account. Historical Guardian/minor consent structures remain inactive for this beta.</li>
          <li><strong className="text-white">Minimal beta operations:</strong> Lodario may retain limited first-party events for completed or failed exports, deletion attempts, feedback delivery, and application reliability. These events must not contain wellness answers, injury details, notes, email addresses, tokens, or message bodies.</li>
        </ul>
      </Section>

      <Section id="health-data" title="Health-data processing">
        <p>
          Wellness, training, readiness, load, pain, injury and recommendation information is processed only after the current required documents are accepted. Declining or failing to complete current acceptance keeps core health-data processing paused while public policies, support, export and deletion remain available.
        </p>
      </Section>

      <Section id="coach-sharing" title="What coaches can see">
        <p>
          A coach can view information for players connected to a team they manage, subject to Lodario&apos;s account permissions and Supabase row-level security. This can include the player&apos;s profile and email, wellness and training logs, readiness and load, pain and injury status, calendar entries, RSVP responses, and attendance. Do not join a team whose coaches should not receive this information.
        </p>
      </Section>

      <Section title="Providers">
        <p>
          Lodario currently relies on Supabase for authentication and application data, Vercel for web hosting and delivery, and Gmail SMTP for feedback and support email delivery. Their processing is governed by their own terms and privacy information:
          {' '}<a className="text-[var(--accent-secondary)] underline" href="https://supabase.com/privacy" rel="noreferrer" target="_blank">Supabase</a>,
          {' '}<a className="text-[var(--accent-secondary)] underline" href="https://vercel.com/legal/privacy-notice" rel="noreferrer" target="_blank">Vercel</a>, and
          {' '}<a className="text-[var(--accent-secondary)] underline" href="https://policies.google.com/privacy" rel="noreferrer" target="_blank">Google</a>.
        </p>
        <p className="mt-3">
          AI conversations, advertising and behavioural tracking, payments, and health-device integrations are disabled for this beta, so Lodario does not send beta data to providers for those features.
        </p>
      </Section>

      <Section title="Retention and security">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-white">Account data:</strong> retained until the user deletes their account.</li>
          <li><strong className="text-white">Error and security logs:</strong> retained for 30 days.</li>
          <li><strong className="text-white">Feedback and support emails:</strong> retained for 12 months.</li>
          <li><strong className="text-white">Manual backups:</strong> retained for 30 days and then securely deleted.</li>
        </ul>
        <p className="mt-3">
          Self-service deletion removes account-owned application records and authentication access. Limited anonymous operational counts may remain after deletion because they no longer identify an account. Data may remain temporarily in provider-managed automatic backups according to the provider plan and recovery configuration; those settings are reviewed separately from Lodario&apos;s 30-day manual-backup rule. Access controls and Supabase row-level security limit data access, but no online system can promise absolute security.
        </p>
      </Section>

      <Section title="Your choices and requests">
        <p>
          Signed-in users can download an owner-scoped JSON export and request permanent account deletion from Player Profile or Coach Settings. Export never includes another Player&apos;s private health information. Deletion requires an explicit phrase and recent authentication. A Coach must first transfer or close any owned team containing another member. Email <EmailLink /> for correction, failed export/deletion, or other privacy help. Deletion may not immediately remove copies held in the 30-day manual-backup window or provider-managed automatic backups.
        </p>
      </Section>

      <Section title="Policy changes">
        <p>
          Material changes will be communicated in the application or by another reasonable method before they take effect where appropriate. The effective date and exact acceptance identifiers identify the current documents. Changing a required identifier causes Lodario to request acceptance again before core processing continues.
        </p>
      </Section>
    </PublicDocumentLayout>
  );
}

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return <section id={id}><h2 className="mb-2 text-xl font-bold text-white">{title}</h2>{children}</section>;
}

function EmailLink() {
  return <a className="text-[var(--accent-secondary)] underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;
}
