interface MetricsGridItem {
  label: string;
  value: string;
  context: string;
  toneClass: string;
}

interface MetricsGridProps {
  items: MetricsGridItem[];
}

export function MetricsGrid({ items }: MetricsGridProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <article key={item.label} className="glass-card p-4">
          <p className="text-[11px] uppercase tracking-wide text-gray-400">{item.label}</p>
          <p className={`mt-1 text-xl font-bold ${item.toneClass}`}>{item.value}</p>
          <p className="mt-1 text-xs text-gray-400">{item.context}</p>
        </article>
      ))}
    </div>
  );
}
