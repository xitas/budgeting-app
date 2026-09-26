import type { RecurringFrequency } from "shared";

export function describeFrequency(frequency: RecurringFrequency, interval: number): string {
  const unit = frequency === "daily" ? "day" : frequency === "weekly" ? "week" : "month";
  return interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;
}
