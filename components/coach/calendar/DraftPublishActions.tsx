import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface DraftPublishActionsProps {
  onDraft: () => void;
  onPublish: () => void;
}

export function DraftPublishActions({ onDraft, onPublish }: DraftPublishActionsProps) {
  const [showDraftMenu, setShowDraftMenu] = useState(false);
  const draftMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeMenuOnOutsideClick = (event: MouseEvent) => {
      if (!draftMenuRef.current?.contains(event.target as Node)) {
        setShowDraftMenu(false);
      }
    };

    document.addEventListener('mousedown', closeMenuOnOutsideClick);
    return () => {
      document.removeEventListener('mousedown', closeMenuOnOutsideClick);
    };
  }, []);

  return (
    <div className="space-y-2 border-t border-[rgba(255,255,255,0.08)] pt-4">
      <div className="relative" ref={draftMenuRef}>
        <div className="grid grid-cols-[minmax(0,1fr)_44px] overflow-hidden rounded-xl border border-[rgba(255,255,255,0.14)]">
          <button
            type="button"
            onClick={() => {
              onDraft();
              setShowDraftMenu(false);
            }}
            className="bg-[rgba(255,255,255,0.08)] py-3 text-sm font-semibold text-white transition-colors hover:bg-[rgba(255,255,255,0.14)]"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={() => setShowDraftMenu((previous) => !previous)}
            className="border-l border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.08)] text-gray-200 transition-colors hover:bg-[rgba(255,255,255,0.14)]"
            aria-expanded={showDraftMenu}
            aria-label="Open draft publish options"
          >
            <ChevronDown size={16} className={`mx-auto transition-transform ${showDraftMenu ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showDraftMenu ? (
          <div className="absolute right-0 top-[calc(100%+6px)] z-20 w-56 rounded-lg border border-[rgba(255,255,255,0.14)] bg-[rgba(10,14,39,0.96)] p-2 shadow-xl">
            <button type="button" disabled className="w-full rounded-md px-3 py-2 text-left text-xs text-gray-500">
              Scheduled publish (coming soon)
            </button>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => {
          onPublish();
          setShowDraftMenu(false);
        }}
        className="w-full rounded-xl bg-gradient-to-r from-[var(--accent-primary)] to-emerald-500 py-3 text-sm font-bold text-black transition-transform active:scale-[0.99]"
      >
        Save and Publish
      </button>
    </div>
  );
}
