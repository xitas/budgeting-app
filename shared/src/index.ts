export type TransactionType = "income" | "expense";

export type TransactionSource = "manual" | "recurring";

export type RecurringFrequency = "daily" | "weekly" | "monthly";

export interface HealthResponse {
  status: "ok";
  uptime: number;
}
