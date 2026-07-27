import { Request, Response } from "express";
import * as budgetService from "../services/budget.service";
import { CreateBudgetInput, ListBudgetsQuery, UpdateBudgetInput } from "../validation/budget.validation";

export async function listBudgetsHandler(req: Request, res: Response): Promise<void> {
  const { month, year } = req.query as unknown as ListBudgetsQuery;
  const budgets = await budgetService.listBudgets(req.userId!, month, year);
  res.status(200).json({ budgets });
}

export async function createBudgetHandler(req: Request, res: Response): Promise<void> {
  const budget = await budgetService.createBudget(req.userId!, req.body as CreateBudgetInput);
  res.status(201).json({ budget });
}

export async function updateBudgetHandler(req: Request, res: Response): Promise<void> {
  const budget = await budgetService.updateBudget(req.userId!, req.params.id, req.body as UpdateBudgetInput);
  res.status(200).json({ budget });
}

export async function deleteBudgetHandler(req: Request, res: Response): Promise<void> {
  await budgetService.deleteBudget(req.userId!, req.params.id);
  res.status(204).send();
}
