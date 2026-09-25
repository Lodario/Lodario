import type { Metadata } from 'next';
import { DeleteAccountForm } from '@/components/DeleteAccountForm';

export const metadata: Metadata = {
  title: 'Delete Account and Data | Lodario',
  description: 'Permanently delete your Lodario account and associated account data.',
  alternates: { canonical: '/delete-account' },
};

export default function DeleteAccountPage() {
  return <DeleteAccountForm />;
}
