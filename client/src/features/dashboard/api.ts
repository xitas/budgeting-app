import { apiClient } from "../../lib/apiClient";
import type { BudgetVsActual, CategorySpending, DashboardSummary, MonthlyTrendPoint } from "./types";

export async function getSummary(month: number, year: number): Promise<DashboardSummary> {
  const res = await apiClient.get<DashboardSummary>("/dashboard/summary", { params: { month, year } });
  return res.data;
}

export async function getSpendingByCategory(month: number, year: number): Promise<CategorySpending[]> {
  const res = await apiClient.get<{ spending: CategorySpending[] }>("/dashboard/spending-by-category", {
    params: { month, year },
  });
  return res.data.spending;
}

export async function getIncomeVsExpense(month: number, year: number, months = 6): Promise<MonthlyTrendPoint[]> {
  const res = await apiClient.get<{ trend: MonthlyTrendPoint[] }>("/dashboard/income-vs-expense", {
    params: { month, year, months },
  });
  return res.data.trend;
}

export async function getBudgetVsActual(month: number, year: number): Promise<BudgetVsActual[]> {
  const res = await apiClient.get<{ budgets: BudgetVsActual[] }>("/dashboard/budget-vs-actual", {
    params: { month, year },
  });
  return res.data.budgets;
}
