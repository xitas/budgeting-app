import { useQuery } from "@tanstack/react-query";
import * as api from "./api";

export function useDashboardSummary(month: number, year: number) {
  return useQuery({ queryKey: ["dashboard", "summary", month, year], queryFn: () => api.getSummary(month, year) });
}

export function useSpendingByCategory(month: number, year: number) {
  return useQuery({
    queryKey: ["dashboard", "spending-by-category", month, year],
    queryFn: () => api.getSpendingByCategory(month, year),
  });
}

export function useIncomeVsExpense(month: number, year: number, months = 6) {
  return useQuery({
    queryKey: ["dashboard", "income-vs-expense", month, year, months],
    queryFn: () => api.getIncomeVsExpense(month, year, months),
  });
}

export function useBudgetVsActual(month: number, year: number) {
  return useQuery({
    queryKey: ["dashboard", "budget-vs-actual", month, year],
    queryFn: () => api.getBudgetVsActual(month, year),
  });
}
