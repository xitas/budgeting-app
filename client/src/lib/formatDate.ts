const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Use UTC getters — transaction dates are stored as plain midnight-UTC
// dates, so local-timezone getters could shift the displayed day.
export function formatDisplayDate(isoDate: string): string {
  const date = new Date(isoDate);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = MONTH_ABBR[date.getUTCMonth()];
  return `${day}-${month}-${date.getUTCFullYear()}`;
}
