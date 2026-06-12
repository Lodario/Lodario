import { FormEvent, useEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import type { CoachTeam } from '@/lib/coach/selectedTeam';
import { SelectedTeamIndicator } from '@/components/coach/SelectedTeamIndicator';

export interface TeamAverages {
  players: number;
  averageAge: number | null;
  averageHeightCm: number | null;
  averageWeightKg: number | null;
  averageReadiness: number | null;
  averageLoad: number | null;
}

interface TeamCardProps {
  team: CoachTeam;
  averages: TeamAverages;
  selected: boolean;
  onSelect: (teamId: string) => void;
  onUpdateTeam: (input: { teamId: string; name: string; code?: string }) => Promise<{ error: string | null }>;
  onDeleteTeam: (teamId: string) => Promise<{ error: string | null }>;
  canDelete: boolean;
}

function getTeamAvatarLabel(team: CoachTeam): string {
  const codeParts = team.code.split('-');
  if (codeParts.length > 0 && codeParts[0]) {
    return codeParts[0].slice(0, 3);
  }

  return team.name
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

export function TeamCard({ team, averages, selected, onSelect, onUpdateTeam, onDeleteTeam, canDelete }: TeamCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [draftName, setDraftName] = useState(team.name);
  const [draftCode, setDraftCode] = useState(team.code);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const cardStateClasses = selected
    ? 'border-[rgba(var(--accent-primary-rgb),0.45)] bg-[rgba(var(--accent-primary-rgb),0.09)] shadow-[0_10px_24px_rgba(var(--accent-primary-rgb),0.14)]'
    : 'hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(var(--surface-elevated-rgb),0.92)]';

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);
    setIsSaving(true);
    const { error } = await onUpdateTeam({
      teamId: team.id,
      name: draftName,
      code: draftCode,
    });
    setIsSaving(false);

    if (error) {
      setActionError(error);
      return;
    }

    setIsEditing(false);
  };

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleDocumentClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, [isMenuOpen]);

  const handleDelete = async () => {
    setActionError(null);
    setIsMenuOpen(false);

    const confirmed = window.confirm(`Delete team "${team.name}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    const { error } = await onDeleteTeam(team.id);
    setIsDeleting(false);

    if (error) {
      setActionError(error);
    }
  };

  return (
    <article className={`glass-card w-full p-5 text-left transition-all duration-200 sm:p-6 ${cardStateClasses}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.06)] text-sm font-bold text-white">
            {getTeamAvatarLabel(team)}
          </div>
          <div>
            <p className="text-base font-semibold text-white">{team.name}</p>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-gray-400">
              {team.code}
            </p>
          </div>
        </div>
        <div className="relative flex items-center gap-2" ref={menuRef}>
          <SelectedTeamIndicator selected={selected} />
          <button
            type="button"
            aria-label="Team actions"
            onClick={() => setIsMenuOpen((current) => !current)}
            className="rounded-md border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] p-1 text-gray-300 transition-colors hover:bg-[rgba(255,255,255,0.1)] hover:text-white"
          >
            <MoreVertical size={14} />
          </button>
          {isMenuOpen ? (
            <div className="absolute right-0 top-8 z-20 min-w-[140px] rounded-lg border border-[rgba(255,255,255,0.14)] bg-[rgba(var(--surface-shell-rgb),0.98)] p-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setDraftName(team.name);
                  setDraftCode(team.code);
                  setIsEditing(true);
                  setIsMenuOpen(false);
                }}
                className="w-full rounded-md px-2.5 py-1.5 text-left text-xs font-semibold text-gray-200 transition-colors hover:bg-[rgba(255,255,255,0.08)]"
              >
                Edit Team
              </button>
              {canDelete ? (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDelete}
                  className="mt-1 w-full rounded-md px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--status-red)] transition-colors hover:bg-[rgba(255,107,107,0.14)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Team'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <dl className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <dt className="text-gray-300">Players</dt>
          <dd className="rounded-md border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] px-2 py-0.5 text-xs font-semibold text-white">
            {averages.players}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <dt className="text-gray-300">Avg age</dt>
          <dd className="rounded-md border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] px-2 py-0.5 text-xs font-semibold text-white">
            {averages.averageAge == null ? '--' : `${averages.averageAge.toFixed(1)}y`}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <dt className="text-gray-300">Avg height</dt>
          <dd className="rounded-md border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] px-2 py-0.5 text-xs font-semibold text-white">
            {averages.averageHeightCm == null ? '--' : `${averages.averageHeightCm.toFixed(0)} cm`}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <dt className="text-gray-300">Avg weight</dt>
          <dd className="rounded-md border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] px-2 py-0.5 text-xs font-semibold text-white">
            {averages.averageWeightKg == null ? '--' : `${averages.averageWeightKg.toFixed(0)} kg`}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <dt className="text-gray-300">Avg readiness</dt>
          <dd className="rounded-md border border-[rgba(var(--accent-primary-rgb),0.3)] bg-[rgba(var(--accent-primary-rgb),0.1)] px-2 py-0.5 text-xs font-semibold text-[var(--accent-primary)]">
            {averages.averageReadiness == null ? '--' : `${averages.averageReadiness.toFixed(0)}%`}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <dt className="text-gray-300">Avg load</dt>
          <dd className="rounded-md border border-[rgba(var(--accent-secondary-rgb),0.35)] bg-[rgba(var(--accent-secondary-rgb),0.12)] px-2 py-0.5 text-xs font-semibold text-[var(--accent-secondary)]">
            {averages.averageLoad == null ? '--' : averages.averageLoad.toFixed(0)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSelect(team.id)}
          className="rounded-lg border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white transition-colors hover:bg-[rgba(255,255,255,0.1)]"
        >
          {selected ? 'Selected' : 'Select Team'}
        </button>
      </div>

      {isEditing ? (
        <form onSubmit={handleSave} className="mt-3 grid grid-cols-1 gap-2.5">
          <input
            type="text"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="Team name"
            required
            className="rounded-lg border border-[rgba(255,255,255,0.16)] bg-[rgba(var(--surface-shell-rgb),0.96)] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-[var(--accent-secondary)]"
          />
          <input
            type="text"
            value={draftCode}
            onChange={(event) => setDraftCode(event.target.value.toUpperCase())}
            placeholder="Invite code"
            className="rounded-lg border border-[rgba(255,255,255,0.16)] bg-[rgba(var(--surface-shell-rgb),0.96)] px-3 py-2 text-sm uppercase text-white outline-none transition-colors focus:border-[var(--accent-secondary)]"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg border border-[rgba(var(--accent-primary-rgb),0.4)] bg-[rgba(var(--accent-primary-rgb),0.14)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent-primary)] transition-colors hover:bg-[rgba(var(--accent-primary-rgb),0.2)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftName(team.name);
                setDraftCode(team.code);
                setIsEditing(false);
                setActionError(null);
              }}
              className="rounded-lg border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white transition-colors hover:bg-[rgba(255,255,255,0.1)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {actionError ? <p className="mt-2 text-xs text-[var(--status-red)]">{actionError}</p> : null}
    </article>
  );
}
