
import { formatMoney } from "shared";

// Rounds a max value up to a clean axis top (1 / 2 / 2.5 / 5 × 10^k) so
// gridline labels read as 0 / 500 / 1,000 rather than 0 / 437 / 874.
export function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
}

// Axis ticks: compact and comma'd (950 / 1.2K / 3.4M).
export function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (Math.abs(value) >= 1_000) return `${trim(value / 1_000)}K`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function trim(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

// Money labels: values are integer cents, formatted by the shared helper so
// charts read exactly like the rest of the app.
export function formatAmount(cents: number): string {
  return formatMoney(cents);
}
