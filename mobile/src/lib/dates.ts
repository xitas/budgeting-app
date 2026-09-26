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
