import { CATEGORICAL_PALETTE } from "shared";
import { useSchemeColor } from "../../context/ThemeContext";

interface ProgressBarProps {
  value: number;
  max: number;
  color: string;
}

// Palette red slot, stepped for the current scheme.
const OVER_COLOR = CATEGORICAL_PALETTE[7];

export function ProgressBar({ value, max, color }: ProgressBarProps) {
  const schemeColor = useSchemeColor();
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const over = value > max;

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${percent}%`, backgroundColor: over ? schemeColor(OVER_COLOR) : color }}
      />
    </div>
  );
}
