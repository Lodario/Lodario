import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  deliverFeedbackEmail,
  getFeedbackTransportOptions,
} from '../lib/email/feedback-delivery.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const requiredEnvironmentNames = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SITE_URL',
  'LEGAL_OPERATOR_NAME',
  'GMAIL_SMTP_USER',
  'GMAIL_SMTP_APP_PASSWORD',
  'FEEDBACK_EMAIL_TO',
  'EMAIL_FROM',
];
const serverOnlyNames = [
  'GMAIL_SMTP_USER',
  'GMAIL_SMTP_APP_PASSWORD',
  'FEEDBACK_EMAIL_TO',
  'EMAIL_FROM',
  'LEGAL_OPERATOR_NAME',
];
const publicPages = [
  ['privacy', 'Privacy Policy'],
  ['terms', 'Terms of Use'],
  ['health-disclaimer', 'Health and Injury Disclaimer'],
  ['cookies', 'Cookie Information'],
  ['support', 'Support and Contact'],
];

async function filesUnder(relativeDirectory) {
  const absoluteDirectory = path.join(root, relativeDirectory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(relative));
    else files.push(relative);
  }
  return files;
}

test('sanitised environment example documents every active beta variable', async () => {
  const example = await readFile(path.join(root, '.env.example'), 'utf8');
  const gitignore = await readFile(path.join(root, '.gitignore'), 'utf8');
  for (const name of requiredEnvironmentNames) {
    assert.match(example, new RegExp(`^${name}=`, 'm'), name);
  }
  const configuredValues = example
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.slice(line.indexOf('=') + 1))
    .join('\n');
  assert.doesNotMatch(configuredValues, /service[_-]?role|sk_live_|sk-[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/i);
  assert.match(example, /your_public_supabase_anon_key/);
  assert.match(example, /your_gmail_app_password_here/);
  assert.match(example, /^NEXT_PUBLIC_SITE_URL=https:\/\/lodario\.vercel\.app$/m);
  assert.match(example, /^LEGAL_OPERATOR_NAME=REPLACE_WITH_YOUR_FULL_LEGAL_NAME$/m);
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^\.env\.\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
  assert.match(gitignore, /^\/backups\/$/m);
});

test('environment validation separates public and server-only configuration', async () => {
  const publicEnvironment = await readFile(path.join(root, 'lib/env/public.ts'), 'utf8');
  const serverEnvironment = await readFile(path.join(root, 'lib/env/server.ts'), 'utf8');
  assert.match(serverEnvironment, /^import 'server-only';/);
  assert.match(publicEnvironment, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(publicEnvironment, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  for (const name of serverOnlyNames) {
    assert.match(serverEnvironment, new RegExp(name), name);
    assert.doesNotMatch(publicEnvironment, new RegExp(name), name);
  }
  assert.match(serverEnvironment, /process\.env\.NODE_ENV === 'production'/);
  assert.match(serverEnvironment, /process\.env\.VERCEL === '1'/);
  assert.match(serverEnvironment, /Missing required public configuration: NEXT_PUBLIC_SITE_URL/);
  assert.match(serverEnvironment, /Missing required public configuration: LEGAL_OPERATOR_NAME/);
});

test('server-only environment names are not read by client components', async () => {
  const sourceFiles = [
    ...await filesUnder('app'),
    ...await filesUnder('components'),
    ...await filesUnder('hooks'),
    ...await filesUnder('lib'),
  ].filter((file) => /\.(?:ts|tsx|js|jsx|mjs)$/.test(file));

  for (const file of sourceFiles) {
    const source = await readFile(path.join(root, file), 'utf8');
    if (!source.startsWith("'use client';") && !source.startsWith('"use client";')) continue;
    for (const name of serverOnlyNames) {
      assert.doesNotMatch(source, new RegExp(`process\\.env\\.${name}\\b`), `${name} in ${file}`);
    }
  }
});

test('every required public page has route metadata, canonical URL, versioning, and contact coverage', async () => {
  const layout = await readFile(path.join(root, 'components/legal/PublicDocumentLayout.tsx'), 'utf8');
  const constants = await readFile(path.join(root, 'lib/legal.ts'), 'utf8');
  assert.match(layout, /LEGAL_EFFECTIVE_DATE/);
  assert.match(layout, /LEGAL_DOCUMENT_VERSION/);
  assert.match(constants, /contact\.lodario@gmail\.com/);

  for (const [route, title] of publicPages) {
    const source = await readFile(path.join(root, 'app', route, 'page.tsx'), 'utf8');
    assert.match(source, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), route);
    assert.match(source, new RegExp(`canonical: '/${route}'`), route);
    assert.match(source, /export const metadata/);
  }
});

test('public documents describe current beta limits and real provider/storage flows', async () => {
  const privacy = await readFile(path.join(root, 'app/privacy/page.tsx'), 'utf8');
  const health = await readFile(path.join(root, 'app/health-disclaimer/page.tsx'), 'utf8');
  const cookies = await readFile(path.join(root, 'app/cookies/page.tsx'), 'utf8');
  const support = await readFile(path.join(root, 'app/support/page.tsx'), 'utf8');

  for (const provider of ['Supabase', 'Vercel', 'Gmail']) assert.match(privacy, new RegExp(provider));
  for (const disabled of ['AI conversations', 'advertising', 'payments', 'health-device integrations']) {
    assert.match(privacy, new RegExp(disabled));
  }
  assert.match(privacy, /Account data:[\s\S]*retained until the user deletes their account/);
  assert.match(privacy, /Error and security logs:[\s\S]*retained for 30 days/);
  assert.match(privacy, /Feedback and support emails:[\s\S]*retained for 12 months/);
  assert.match(privacy, /Manual backups:[\s\S]*retained for 30 days/);
  assert.match(health, /does not diagnose, treat, cure, or prevent/);
  assert.match(health, /emergency service/);
  assert.match(cookies, /local storage/i);
  assert.match(cookies, /session storage/i);
  assert.match(cookies, /service worker/i);
  assert.match(cookies, /does not show a non-essential cookie consent banner/i);
  assert.match(support, /never ask you to send your password/i);
  assert.match(support, /Signed-in users can download their data or delete their account/);
});

test('legal and support navigation is present on every required integration surface', async () => {
  const expectedFiles = [
    'app/beta/page.tsx',
    'components/AuthGate.tsx',
    'components/OnboardingFlow.tsx',
    'app/profile/page.tsx',
    'components/coach/settings/CoachSettingsPage.tsx',
    'components/PublicBetaAgeGate.tsx',
  ];
  for (const file of expectedFiles) {
    const source = await readFile(path.join(root, file), 'utf8');
    assert.match(source, /PublicLegalLinks/, file);
  }
  const feedback = await readFile(path.join(root, 'components/FeedbackModal.tsx'), 'utf8');
  assert.match(feedback, /href="\/privacy"/);
  assert.match(feedback, /href="\/support"/);
});

test('feedback and guardian email paths do not log message bodies, recipients, or thrown objects', async () => {
  const feedbackRoute = await readFile(path.join(root, 'app/api/feedback/route.ts'), 'utf8');
  const guardianEmail = await readFile(path.join(root, 'lib/guardian/email.ts'), 'utf8');
  const guardianRoute = await readFile(path.join(root, 'app/api/guardian/invitations/route.ts'), 'utf8');
  assert.doesNotMatch(feedbackRoute, /console\.(?:log|error)\([^)]*,\s*error/);
  assert.doesNotMatch(guardianRoute, /console\.(?:log|error)\([^)]*,\s*error/);
  assert.doesNotMatch(guardianEmail, /console\.(?:log|error)/);
  assert.doesNotMatch(guardianEmail, /actionUrl.*console|console.*actionUrl/);
});

test('feedback delivery uses a mock transport and never sends a real test email', async () => {
  const sentMessages = [];
  const transportOptions = [];
  const config = {
    user: 'smtp-user@example.invalid',
    appPassword: 'safe-test-placeholder',
    from: 'Lodario Test <smtp-user@example.invalid>',
    to: 'feedback@example.invalid',
  };
  const createTransport = (options) => {
    transportOptions.push(options);
    return {
      async sendMail(message) {
        sentMessages.push(message);
      },
    };
  };

  await deliverFeedbackEmail({
    createTransport,
    config,
    message: {
      replyTo: 'tester@example.invalid',
      subject: 'Safe mocked feedback',
      text: 'Mock body',
      html: '<p>Mock body</p>',
    },
  });

  assert.deepEqual(transportOptions, [getFeedbackTransportOptions(config)]);
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].to, config.to);
  assert.equal(sentMessages[0].subject, 'Safe mocked feedback');
});

test('health wording stays informational while emergency and professional-care warnings remain', async () => {
  const sources = [
    await readFile(path.join(root, 'components/InjuryTracker.tsx'), 'utf8'),
    await readFile(path.join(root, 'components/RecommendationCard.tsx'), 'utf8'),
    await readFile(path.join(root, 'app/page.tsx'), 'utf8'),
    await readFile(path.join(root, 'app/health-disclaimer/page.tsx'), 'utf8'),
  ].join('\n');

  for (const removedWording of [
    'Injury Protocol',
    'Auto-Detected Protocol',
    'active recovery protocol',
    'prescribed recovery plan',
    'keep football work modified and avoid extra intensity',
  ]) {
    assert.doesNotMatch(sources, new RegExp(removedWording, 'i'), removedWording);
  }
  for (const replacement of [
    'Injury Support',
    'Automatically Suggested Support',
    'active recovery guidance',
    'suggested recovery plan',
    'reduce football intensity and avoid adding extra high-intensity work',
  ]) {
    assert.match(sources, new RegExp(replacement, 'i'), replacement);
  }
  assert.match(sources, /does not diagnose, treat, cure, or prevent/i);
  assert.match(sources, /emergency service/i);
  assert.match(sources, /qualified professional/i);
});

test('key public and account surfaces retain responsive, labelled, keyboard-visible controls', async () => {
  const globals = await readFile(path.join(root, 'app/globals.css'), 'utf8');
  const publicLayout = await readFile(path.join(root, 'components/legal/PublicDocumentLayout.tsx'), 'utf8');
  const auth = await readFile(path.join(root, 'components/AuthGate.tsx'), 'utf8');
  const onboarding = await readFile(path.join(root, 'components/OnboardingFlow.tsx'), 'utf8');
  const feedback = await readFile(path.join(root, 'components/FeedbackModal.tsx'), 'utf8');
  const coachSettings = await readFile(path.join(root, 'components/coach/settings/CoachSettingsPage.tsx'), 'utf8');

  assert.match(globals, /:focus-visible/);
  assert.match(globals, /outline: 2px solid var\(--accent-primary\)/);
  assert.match(publicLayout, /max-w-3xl/);
  assert.match(publicLayout, /px-4[\s\S]*?sm:px-6/);
  assert.match(publicLayout, /aria-label="Lodario beta home"/);
  assert.match(auth, /htmlFor="auth-email"/);
  assert.match(auth, /htmlFor="auth-password"/);
  assert.match(onboarding, /htmlFor="onboarding-display-name"/);
  assert.match(onboarding, /aria-labelledby="onboarding-position-label"/);
  assert.match(feedback, /htmlFor="feedback-email"/);
  assert.match(feedback, /htmlFor="feedback-title"/);
  assert.match(feedback, /htmlFor="feedback-description"/);
  assert.match(feedback, /overflow-y-auto/);
  assert.match(coachSettings, /htmlFor="coach-new-password"/);
  assert.match(coachSettings, /htmlFor="coach-confirm-password"/);
  assert.match([auth, feedback, coachSettings].join('\n'), /role="alert"/);
});
