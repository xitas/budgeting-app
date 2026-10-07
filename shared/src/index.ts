export type TransactionType = "income" | "expense";

export type TransactionSource = "manual" | "recurring" | "loan" | "import";

export type LoanDirection = "lent" | "borrowed";

export type LoanStatus = "open" | "settled" | "written_off";

export type RecurringFrequency = "daily" | "weekly" | "monthly";

export interface HealthResponse {
  status: "ok";
  uptime: number;
}

// Validated categorical palette (fixed order — this order is the CVD-safety
// mechanism, never reassign/cycle it per chart). Used to seed each user's
// default categories, and as the initial color options offered when a user
// creates a custom category.
export const CATEGORICAL_PALETTE = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
] as const;

// The same eight hues stepped for a dark surface (validated against the dark
// card color #161f2e: lightness band, CVD separation and >= 3:1 contrast all
// pass). Same slot order as CATEGORICAL_PALETTE — never reorder one without
// the other.
export const CATEGORICAL_PALETTE_DARK = [
  "#3987e5", // blue
  "#d95926", // orange
  "#199e70", // aqua
  "#c98500", // yellow
  "#d55181", // magenta
  "#008300", // green
  "#9085e9", // violet
  "#e66767", // red
] as const;

export type ColorScheme = "light" | "dark";

// Category colors are stored as their light-palette hex. In dark mode, a
// stored palette color renders as its dark step (same slot, so identity is
// kept); any custom color (picked freely on the web) passes through as-is.
export function schemeColor(hex: string, scheme: ColorScheme): string {
  if (scheme === "light") return hex;
  const slot = CATEGORICAL_PALETTE.findIndex((c) => c.toLowerCase() === hex.toLowerCase());
  return slot === -1 ? hex : CATEGORICAL_PALETTE_DARK[slot];
}

// Money: integer cents everywhere, plus the shared parse/format helpers.
export * from "./money";
export * from "./currency";

// CSV import parsing (web + mobile).
export * from "./csvImport";

// API request/response shapes, shared by the web client and the mobile app.
export * from "./api/account";
export * from "./api/auth";
export * from "./api/backup";
export * from "./api/budgets";
export * from "./api/categories";
export * from "./api/dashboard";
export * from "./api/loans";
export * from "./api/recurring";
export * from "./api/transactions";
