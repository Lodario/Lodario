interface SelectedTeamIndicatorProps {
  selected: boolean;
}

export function SelectedTeamIndicator({ selected }: SelectedTeamIndicatorProps) {
  if (selected) {
    return (
      <span className="rounded-full border border-[rgba(var(--accent-primary-rgb),0.4)] bg-[rgba(var(--accent-primary-rgb),0.12)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent-primary)]">
        Active
      </span>
    );
  }

  return (
    <span className="rounded-full border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-gray-300">
      Select
    </span>
  );
}
