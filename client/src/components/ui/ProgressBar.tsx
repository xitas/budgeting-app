interface ProgressBarProps {
  value: number;
  max: number;
  color: string;
}

const OVER_COLOR = "#e34948";

export function ProgressBar({ value, max, color }: ProgressBarProps) {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const over = value > max;

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${percent}%`, backgroundColor: over ? OVER_COLOR : color }}
      />
    </div>
  );
}
