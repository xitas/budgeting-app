export type TransactionType = "income" | "expense";

export type TransactionSource = "manual" | "recurring";

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
