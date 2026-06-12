import { ChevronDown, Check } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { TeamPlayerDataset } from '@/components/coach/players/types';

interface PlayerSelectorDropdownProps {
  players: TeamPlayerDataset[];
  selectedPlayerId: string;
  onSelectPlayer: (playerId: string) => void;
}

export function PlayerSelectorDropdown({
  players,
  selectedPlayerId,
  onSelectPlayer,
}: PlayerSelectorDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedPlayer = useMemo(() => {
    return players.find((dataset) => dataset.player.id === selectedPlayerId)?.player ?? players[0]?.player;
  }, [players, selectedPlayerId]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative w-full sm:w-[320px]">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">Selected Player</p>
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="flex w-full items-center justify-between rounded-xl border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.05)] px-3 py-2.5 text-left transition-colors hover:border-[rgba(255,255,255,0.22)]"
        aria-expanded={open}
        aria-label="Select player"
      >
        <span className="truncate text-sm font-semibold text-white">
          {selectedPlayer?.name ?? 'Select player'}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-gray-300 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-20 mt-1.5 overflow-hidden rounded-xl border border-[rgba(255,255,255,0.14)] bg-[rgba(var(--surface-shell-rgb),0.97)] shadow-xl">
          <ul className="max-h-64 overflow-y-auto py-1">
            {players.map((dataset) => {
              const isSelected = dataset.player.id === selectedPlayerId;
              return (
                <li key={dataset.player.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectPlayer(dataset.player.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-[rgba(var(--accent-primary-rgb),0.12)] text-[var(--accent-primary)]'
                        : 'text-gray-200 hover:bg-[rgba(255,255,255,0.06)]'
                    }`}
                    aria-pressed={isSelected}
                  >
                    <span className="truncate">{dataset.player.name}</span>
                    {isSelected ? <Check size={14} className="shrink-0" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
