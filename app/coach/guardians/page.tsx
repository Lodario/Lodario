'use client';

import { useCoachTeam } from '@/lib/coach/selectedTeam';
import { CoachGuardianSheet } from '@/components/coach/guardians/CoachGuardianSheet';

export default function CoachGuardiansPage() {
  const { selectedTeam, isLoadingTeams } = useCoachTeam();
  return <CoachGuardianSheet key={selectedTeam.id} teamId={selectedTeam.id} loadingTeam={isLoadingTeams} />;
}
