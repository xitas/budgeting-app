import { Request, Response } from "express";
import * as budgetService from "../services/budget.service";
import * as dashboardService from "../services/dashboard.service";
import { DashboardQuery, TrendQuery } from "../validation/dashboard.validation";

export async function getSummaryHandler(req: Request, res: Response): Promise<void> {
  const { month: qMonth, year: qYear } = req.query as unknown as DashboardQuery;
  const { month, year } = dashboardService.resolveMonthYear(qMonth, qYear);
  const summary = await dashboardService.getSummary(req.userId!, month, year);
  res.status(200).json(summary);
}

export async function getSpendingByCategoryHandler(req: Request, res: Response): Promise<void> {
  const { month: qMonth, year: qYear } = req.query as unknown as DashboardQuery;
  const { month, year } = dashboardService.resolveMonthYear(qMonth, qYear);
  const spending = await dashboardService.getSpendingByCategory(req.userId!, month, year);
  res.status(200).json({ spending });
}

export async function getIncomeVsExpenseHandler(req: Request, res: Response): Promise<void> {
  const { month: qMonth, year: qYear, months } = req.query as unknown as TrendQuery;
  const { month, year } = dashboardService.resolveMonthYear(qMonth, qYear);
  const trend = await dashboardService.getIncomeVsExpenseTrend(req.userId!, month, year, months ?? 6);
  res.status(200).json({ trend });
}

export async function getBudgetVsActualHandler(req: Request, res: Response): Promise<void> {
  const { month: qMonth, year: qYear } = req.query as unknown as DashboardQuery;
  const { month, year } = dashboardService.resolveMonthYear(qMonth, qYear);
  const budgets = await budgetService.listBudgets(req.userId!, month, year);
  res.status(200).json({ budgets });
}
