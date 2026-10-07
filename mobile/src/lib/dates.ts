const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Dates travel as plain "YYYY-MM-DD" strings and are stored server-side as
// midnight UTC, so every conversion here works on calendar parts, never on
// a timestamp that a timezone could shift by a day.

// Same format as the web client: dd-Mon-yyyy, read with UTC getters.
export function formatDisplayDate(isoDate: string): string {
  const date = new Date(isoDate);
  return `${pad(date.getUTCDate())}-${MONTH_ABBR[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
}

export function todayIso(): string {
  return localDateToIso(new Date());
}

// "2026-09-26" -> a local Date at that calendar day (what a native picker shows).
export function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

// A local Date from a native picker -> "YYYY-MM-DD" of the day the user tapped.
export function localDateToIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function shiftMonth(month: number, year: number, delta: number): { month: number; year: number } {
  const zeroBased = year * 12 + (month - 1) + delta;
  return { month: (zeroBased % 12) + 1, year: Math.floor(zeroBased / 12) };
}

export function shortMonthLabel(yearMonth: string): string {
  // "2026-01" -> "Jan"
  return MONTH_ABBR[Number(yearMonth.slice(5, 7)) - 1] ?? yearMonth;
}

export type DatePreset = "all" | "thisMonth" | "lastMonth" | "last3Months" | "custom";

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "last3Months", label: "Last 3 months" },
  { value: "custom", label: "Custom" },
];

function isoDay(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function lastDayOf(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate(); // day 0 of next month
}

// Inclusive YYYY-MM-DD range for a preset, relative to `today` (local).
// "Last 3 months" is this month plus the two before it. "all" and "custom"
// return no bounds (custom dates come from the pickers).
export function datePresetRange(preset: DatePreset, today: Date = new Date()): { from?: string; to?: string } {
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  switch (preset) {
    case "thisMonth":
      return { from: isoDay(year, month, 1), to: isoDay(year, month, lastDayOf(year, month)) };
    case "lastMonth": {
      const prev = shiftMonth(month, year, -1);
      return { from: isoDay(prev.year, prev.month, 1), to: isoDay(prev.year, prev.month, lastDayOf(prev.year, prev.month)) };
    }
    case "last3Months": {
      const start = shiftMonth(month, year, -2);
      return { from: isoDay(start.year, start.month, 1), to: isoDay(year, month, lastDayOf(year, month)) };
    }
    default:
      return {};
  }
}
