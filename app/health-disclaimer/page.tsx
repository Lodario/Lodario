import type { Metadata } from 'next';
import { PublicDocumentLayout } from '@/components/legal/PublicDocumentLayout';
import { REQUIRED_CONSENT_DOCUMENTS, SUPPORT_EMAIL } from '@/lib/legal';

const healthDataVersion = REQUIRED_CONSENT_DOCUMENTS.find((document) => document.documentType === 'health_data_processing')!.documentVersion;

export const metadata: Metadata = {
  title: 'Health and Injury Disclaimer | Lodario',
  description: 'Important limits of Lodario readiness, load, pain, injury, and training recommendation features.',
  alternates: { canonical: '/health-disclaimer' },
};

export default function HealthDisclaimerPage() {
  return (
    <PublicDocumentLayout
      title="Health and Injury Disclaimer"
      description="Please read this before relying on Lodario wellness, readiness, load, pain, injury, or recommendation features."
    >
      <Section title="Informational training tool">
        <p>
          Lodario is a training, wellness, scheduling, and team-management tool. Readiness scores, training load, pain and injury entries, analytics, and recommendations are generated from information entered into the application and are provided as general informational guidance.
        </p>
      </Section>

      <Section title="Current health-data identifier">
        <p>
          Required health-data processing acceptance uses <code>{healthDataVersion}</code>. Reading this disclaimer does not itself record acceptance; acceptance is recorded only from the signed-in consent screen with an unselected checkbox and server-generated time.
        </p>
      </Section>

      <Section title="Not medical care">
        <p>
          Lodario does not diagnose, treat, cure, or prevent injuries, illnesses, or medical conditions. It is not a medical device and is not a replacement for a doctor, physiotherapist, psychologist, dietitian, emergency service, or other qualified professional. A score or recommendation cannot confirm that training is safe.
        </p>
      </Section>

      <Section title="Symptoms and emergencies">
        <p>
          Stop activity and seek appropriate qualified help if pain, illness, injury, dizziness, breathing difficulty, neurological symptoms, or any other symptom is serious, sudden, worsening, persistent, or concerning. For an emergency or risk of immediate harm, contact the emergency service available in your location. Do not wait for Lodario guidance.
        </p>
      </Section>

      <Section title="Players and coaches remain responsible">
        <p>
          Players are responsible for deciding whether to participate and for reporting concerns accurately. Coaches are responsible for their own training, workload, attendance, return-to-play, and player-safety decisions. Automated recommendations and alerts are context-limited and must never override professional, safeguarding, or emergency advice.
        </p>
      </Section>

      <Section title="Questions">
        <p>
          Product questions can be sent to <a className="text-[var(--accent-secondary)] underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Do not send highly sensitive health details by ordinary email.
        </p>
      </Section>
    </PublicDocumentLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="mb-2 text-xl font-bold text-white">{title}</h2>{children}</section>;
}
