'use client';
import { Loader2 } from 'lucide-react';
import { useData } from '@/lib/DataContext';
import { OnboardingFlow } from './OnboardingFlow';
/** Age/country and consent are checked before DataProvider in RootAppShell. */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { profile, isLoading } = useData();
  if (isLoading) return <div className="flex min-h-screen items-center justify-center gap-3"><Loader2 className="animate-spin" />Loading your profile…</div>;
  if (!profile?.onboardingCompleted) return <OnboardingFlow />;
  return <>{children}</>;
}
