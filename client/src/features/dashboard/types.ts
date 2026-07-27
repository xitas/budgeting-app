export interface DashboardSummary {
  income: number; // non-loan income only
  expense: number; // non-loan expense only
  netLending: number; // loan income − loan expense this month (can be negative)
  net: number; // income − expense + netLending
}

export interface CategorySpending {
  categoryId: string;
  name: string;
  color: string;
  amount: number;
}

export interface MonthlyTrendPoint {
  month: string; // "2026-01"
  income: number;
  expense: number;
}

export interface BudgetVsActual {
  id: string;
  category: { id: string; name: string; color: string };
  limit: number;
  month: number;
  year: number;
  spent: number;
  remaining: number;
}
