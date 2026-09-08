export const SUPPORT_EMAIL = 'contact.lodario@gmail.com';
export const LEGAL_EFFECTIVE_DATE = '23 July 2026';
export const LEGAL_DOCUMENT_VERSION = '1.0';

export const REQUIRED_CONSENT_DOCUMENTS = [
  {
    documentType: 'terms_of_use',
    documentVersion: 'terms-2026-07-23-v1.0',
    documentUrl: '/terms',
    label: 'Terms of Use',
  },
  {
    documentType: 'privacy_policy',
    documentVersion: 'privacy-2026-07-23-v1.0',
    documentUrl: '/privacy',
    label: 'Privacy Policy',
  },
  {
    documentType: 'health_data_processing',
    documentVersion: 'health-data-2026-07-23-v1.0',
    documentUrl: '/privacy#health-data',
    label: 'Health-data processing',
  },
  {
    documentType: 'coach_player_data_sharing',
    documentVersion: 'coach-sharing-2026-07-23-v1.0',
    documentUrl: '/privacy#coach-sharing',
    label: 'Coach access and player-data sharing',
  },
] as const;

export const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/health-disclaimer', label: 'Health disclaimer' },
  { href: '/cookies', label: 'Cookie information' },
  { href: '/support', label: 'Support' },
] as const;
