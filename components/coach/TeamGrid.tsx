import type { CoachTeam } from '@/lib/coach/selectedTeam';
import { TeamCard, type TeamAverages } from '@/components/coach/TeamCard';

interface TeamGridProps {
  teams: CoachTeam[];
  selectedTeamId: string;
  onSelectTeam: (teamId: string) => void;
  averagesByTeamId: Record<string, TeamAverages>;
  onUpdateTeam: (input: { teamId: string; name: string; code?: string }) => Promise<{ error: string | null }>;
  onDeleteTeam: (teamId: string) => Promise<{ error: string | null }>;
  canDeleteTeam: (team: CoachTeam) => boolean;
}

export function TeamGrid({
  teams,
  selectedTeamId,
  onSelectTeam,
  averagesByTeamId,
  onUpdateTeam,
  onDeleteTeam,
  canDeleteTeam,
}: TeamGridProps) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {teams.map((team) => {
        const averages = averagesByTeamId[team.id];

        if (!averages) {
          return null;
        }

        return (
          <TeamCard
            key={team.id}
            team={team}
            averages={averages}
            selected={team.id === selectedTeamId}
            onSelect={onSelectTeam}
            onUpdateTeam={onUpdateTeam}
            onDeleteTeam={onDeleteTeam}
            canDelete={canDeleteTeam(team)}
          />
        );
      })}
    </section>
  );
}
