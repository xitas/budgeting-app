import { apiClient } from "../../lib/apiClient";
import type { Budget, CreateBudgetInput, UpdateBudgetInput } from "./types";

export async function listBudgets(month: number, year: number): Promise<Budget[]> {
  const res = await apiClient.get<{ budgets: Budget[] }>("/budgets", { params: { month, year } });
  return res.data.budgets;
}

export async function createBudget(input: CreateBudgetInput): Promise<void> {
  await apiClient.post("/budgets", input);
}

export async function updateBudget(id: string, updates: UpdateBudgetInput): Promise<void> {
  await apiClient.patch(`/budgets/${id}`, updates);
}

export async function deleteBudget(id: string): Promise<void> {
  await apiClient.delete(`/budgets/${id}`);
}
