import type { Cents } from "../money";

export interface DashboardSummary {
  incomeCents: Cents; // non-loan income only
  expenseCents: Cents; // non-loan expense only
  netLendingCents: Cents; // loan income − loan expense this month (can be negative)
  netCents: Cents; // income − expense + netLending
}

export interface CategorySpending {
  categoryId: string;
  name: string;
  color: string;
  amountCents: Cents;
}

export interface MonthlyTrendPoint {
  month: string; // "2026-01"
  incomeCents: Cents;
  expenseCents: Cents;
}

export interface BudgetVsActual {
  id: string;
  category: { id: string; name: string; color: string };
  limitCents: Cents;
  month: number;
  year: number;
  spentCents: Cents;
  remainingCents: Cents;
}
