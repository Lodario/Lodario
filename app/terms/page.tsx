import type { Metadata } from 'next';
import { PublicDocumentLayout } from '@/components/legal/PublicDocumentLayout';
import { getLegalOperatorName, LEGAL_OPERATOR_PLACEHOLDER } from '@/lib/env/server';
import { REQUIRED_CONSENT_DOCUMENTS, SUPPORT_EMAIL } from '@/lib/legal';

const termsVersion = REQUIRED_CONSENT_DOCUMENTS.find((document) => document.documentType === 'terms_of_use')!.documentVersion;

export const metadata: Metadata = {
  title: 'Terms of Use | Lodario',
  description: 'Terms for using the Lodario public beta as a player or coach.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  const operatorName = getLegalOperatorName();

  return (
    <PublicDocumentLayout
      title="Terms of Use"
      description="These Terms apply to player and coach use of Lodario during the current free public beta."
    >
      <Section title="Operator and eligibility">
        <p>
          Lodario is provided by <strong className={operatorName === LEGAL_OPERATOR_PLACEHOLDER ? 'text-amber-300' : 'text-white'}>{operatorName}</strong>.
          Player access depends on date of birth and country of residence. Where the applicable account policy requires it, a verified Guardian must approve the account and accept the required documents. Coach accounts require an adult. Guardians must be adults authorised to act for the Player.
        </p>
      </Section>

      <Section title="Current Terms identifier">
        <p>
          The current acceptance identifier is <code>{termsVersion}</code>. Lodario records the signed-in user, this exact identifier, and a server-generated acceptance time. If the identifier changes, continued core use requires renewed acceptance.
        </p>
      </Section>

      <Section title="Your account and information">
        <p>
          Keep your password and access links private, use an email account you control, provide accurate information, and promptly report suspected unauthorised access. You are responsible for activity performed through your account unless applicable law provides otherwise.
        </p>
      </Section>

      <Section title="Players, coaches, teams and codes">
        <p>
          Players remain responsible for the information they log and for deciding when to seek qualified health or training advice. Coaches remain responsible for their training, attendance, communication, and player-safety decisions. Team codes must be shared only with intended members. Do not access another account, join a team without permission, or use team information outside legitimate team purposes.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>You may use Lodario for lawful personal training and team-management purposes. You must not:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>misuse, harass, impersonate, threaten, or unlawfully monitor another person;</li>
          <li>upload unlawful, harmful, deceptive, infringing, or malicious material;</li>
          <li>probe security, bypass access controls, interfere with the service, scrape protected information, or introduce malware;</li>
          <li>share credentials or team access in a way that exposes another person&apos;s data; or</li>
          <li>use Lodario for emergency, diagnostic, treatment, or other purposes it is not designed to provide.</li>
        </ul>
      </Section>

      <Section title="Content and ownership">
        <p>
          Lodario and its software, design, branding, and documentation remain owned by the operator or relevant licensors. You retain rights in information you submit. You give the operator permission to host, process, display, and share that information only as needed to provide, secure, support, and improve the beta in accordance with the Privacy Policy.
        </p>
      </Section>

      <Section title="Free beta availability">
        <p>
          The beta is currently free. No subscription, payment, or refund terms apply. Beta software may contain bugs, lose availability, change, or experience interruptions. We may modify, suspend, or discontinue features as the beta develops, while respecting rights that cannot legally be excluded.
        </p>
      </Section>

      <Section title="Suspension and ending use">
        <p>
          Access may be limited or suspended when reasonably necessary to investigate abuse, protect users or the service, address a security risk, or enforce these Terms. You may stop using Lodario and use the account-deletion control in Player Profile or Coach Settings. A Coach must first transfer or close owned teams containing other members. Support remains available for failed deletion. Provisions that naturally continue after use ends, including ownership and lawful limitations, will continue.
        </p>
      </Section>

      <Section title="Responsibility and legal rights">
        <p>
          Lodario is provided on a beta basis and cannot guarantee uninterrupted or error-free operation. To the fullest extent permitted by applicable law, the operator is not responsible for indirect or unforeseeable losses caused by use of or inability to use the beta. Nothing in these Terms excludes liability or consumer, privacy, health, or other rights that cannot lawfully be excluded or limited.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          These Terms may change as the beta develops. Material changes will be communicated in the application or by another reasonable method where appropriate. Questions can be sent to <a className="text-[var(--accent-secondary)] underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </Section>
    </PublicDocumentLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="mb-2 text-xl font-bold text-white">{title}</h2>{children}</section>;
}
