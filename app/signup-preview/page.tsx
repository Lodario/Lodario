import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AuthScreen } from '@/components/AuthGate';

export const metadata: Metadata = {
  title: 'Signup Preview | Lodario',
  robots: { index: false, follow: false },
};

export default function SignupPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <AuthScreen preview />;
}
