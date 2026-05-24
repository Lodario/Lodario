import type { AnalyticsViewMode } from '@/components/coach/analytics/types';

interface AnalyticsViewToggleProps {
  value: AnalyticsViewMode;
  onChange: (view: AnalyticsViewMode) => void;
}

const options: Array<{ id: AnalyticsViewMode; label: string }> = [
  { id: 'averages', label: 'Averages' },
  { id: 'individuals', label: 'Individuals' },
];

export function AnalyticsViewToggle({ value, onChange }: AnalyticsViewToggleProps) {
  return (
    <div className="inline-flex rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            value === option.id
              ? 'bg-[var(--card-bg)] text-white shadow-sm'
              : 'text-gray-400 hover:text-white'
          }`}
          aria-pressed={value === option.id}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
