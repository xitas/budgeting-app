export interface DashboardSummary {
  income: number;
  expense: number;
  net: number;
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
