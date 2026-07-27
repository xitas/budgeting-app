interface TooltipPayloadItem {
  value: number;
  name: string;
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
}

// Values lead, labels follow: the number is bold/high-contrast, the series
// name is secondary — inverted from the legend, since here the reader
// already knows the series and wants the figure.
export function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      {label && <p className="mb-1 font-medium text-slate-600">{label}</p>}
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-slate-500">{item.name}:</span>
          <span className="font-semibold text-slate-900">{item.value.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}
