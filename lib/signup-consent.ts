export const MARKETING_EMAIL_CONSENT_VERSION = 'marketing-email-2026-10-07-v1.1';
export const MARKETING_EMAIL_CONSENT_TEXT = 'I agree to receive marketing emails from Lodario. I can unsubscribe at any time.';

// Pending user-editable preference only; never use this metadata to select campaign recipients.
export function buildSignupEmailPreference(marketingEmails = false) {
  return {
    requested: marketingEmails === true,
    version: MARKETING_EMAIL_CONSENT_VERSION,
    text: MARKETING_EMAIL_CONSENT_TEXT,
    source: 'signup',
    status: 'pending',
  };
}
