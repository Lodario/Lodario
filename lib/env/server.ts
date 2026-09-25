import 'server-only';
import { getPublicSupabaseConfig } from './public';

export class EnvironmentConfigurationError extends Error {
  readonly productionMessage: string;

  constructor(developmentMessage: string, productionMessage = 'Service configuration is unavailable.') {
    super(process.env.NODE_ENV === 'production' ? productionMessage : developmentMessage);
    this.name = 'EnvironmentConfigurationError';
    this.productionMessage = productionMessage;
  }
}

type SmtpConfig = {
  user: string;
  appPassword: string;
  from: string;
};

type FeedbackEmailConfig = SmtpConfig & {
  to: string;
};

const ACCOUNT_DELETION_EMAIL = 'contact.lodario@gmail.com';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCAL_SITE_URL = 'http://localhost:3000';
export const LEGAL_OPERATOR_PLACEHOLDER = '[Legal operator name must be configured before launch]';

function isVercelBuild(): boolean {
  return process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
}

function requiredServerValue(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new EnvironmentConfigurationError(`Missing required server configuration: ${name}.`);
  }
  return normalized;
}

function requireEmail(value: string | undefined, name: string): string {
  const normalized = requiredServerValue(value, name);
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new EnvironmentConfigurationError(`Server configuration ${name} must be a valid email address.`);
  }
  return normalized;
}

function requireMailFrom(value: string | undefined): string {
  const normalized = requiredServerValue(value, 'EMAIL_FROM');
  if (!normalized.includes('@')) {
    throw new EnvironmentConfigurationError('Server configuration EMAIL_FROM must contain a valid sender address.');
  }
  return normalized;
}

export function getSmtpServerConfig(): SmtpConfig {
  return {
    user: requireEmail(process.env.GMAIL_SMTP_USER, 'GMAIL_SMTP_USER'),
    appPassword: requiredServerValue(
      process.env.GMAIL_SMTP_APP_PASSWORD,
      'GMAIL_SMTP_APP_PASSWORD',
    ),
    from: requireMailFrom(process.env.EMAIL_FROM),
  };
}

export function getFeedbackEmailServerConfig(): FeedbackEmailConfig {
  return {
    ...getSmtpServerConfig(),
    to: requireEmail(process.env.FEEDBACK_EMAIL_TO, 'FEEDBACK_EMAIL_TO'),
  };
}

export function getAccountDeletionEmailServerConfig(): FeedbackEmailConfig {
  return {
    ...getSmtpServerConfig(),
    to: ACCOUNT_DELETION_EMAIL,
  };
}

export function getSupabaseServerConfig() {
  return getPublicSupabaseConfig();
}

export function getSiteUrl(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configuredUrl && isVercelBuild()) {
    throw new EnvironmentConfigurationError(
      'Missing required public configuration: NEXT_PUBLIC_SITE_URL.',
      'Site configuration is unavailable.',
    );
  }
  const resolvedUrl = configuredUrl || LOCAL_SITE_URL;
  try {
    const parsed = new URL(resolvedUrl);
    const localHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !(localHost && parsed.protocol === 'http:')) {
      throw new Error('invalid protocol');
    }
    return parsed;
  } catch {
    throw new EnvironmentConfigurationError(
      'NEXT_PUBLIC_SITE_URL must be an HTTPS URL, or an HTTP localhost URL for local development.',
      'Site configuration is unavailable.',
    );
  }
}

export function getLegalOperatorName(): string {
  const operatorName = process.env.LEGAL_OPERATOR_NAME?.trim();
  if (!operatorName && isVercelBuild()) {
    throw new EnvironmentConfigurationError(
      'Missing required public configuration: LEGAL_OPERATOR_NAME.',
      'Legal configuration is unavailable.',
    );
  }
  return operatorName || LEGAL_OPERATOR_PLACEHOLDER;
}

export function getSafeConfigurationMessage(
  error: unknown,
  fallback = 'Service configuration is unavailable.',
): string {
  if (error instanceof EnvironmentConfigurationError) {
    return process.env.NODE_ENV === 'production' ? error.productionMessage : error.message;
  }
  return fallback;
}
