'use client';
import { AppLoadingScreen } from './AppLoadingScreen';
import { useData } from '@/lib/DataContext';
import { OnboardingFlow } from './OnboardingFlow';
/** Age/country and consent are checked before DataProvider in RootAppShell. */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { profile, isLoading } = useData();
  if (isLoading) return <AppLoadingScreen />;
  if (!profile?.onboardingCompleted) return <OnboardingFlow />;
  return <>{children}</>;
}
