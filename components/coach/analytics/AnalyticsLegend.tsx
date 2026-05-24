interface AnalyticsLegendProps {
  items: string[];
}

export function AnalyticsLegend({ items }: AnalyticsLegendProps) {
  return (
    <aside className="glass-card h-fit p-4 sm:p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-300">Analytics Legend</h3>
      <ol className="mt-3 space-y-3">
        {items.map((item, index) => (
          <li key={item} className="flex items-start gap-3 text-sm text-gray-200">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.06)] text-xs font-bold text-white">
              {index + 1}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
