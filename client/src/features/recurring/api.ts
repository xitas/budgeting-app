import { apiClient } from "../../lib/apiClient";
import type { CreateRecurringInput, RecurringTransaction, UpdateRecurringInput } from "./types";

export async function listRecurring(): Promise<RecurringTransaction[]> {
  const res = await apiClient.get<{ recurring: RecurringTransaction[] }>("/recurring");
  return res.data.recurring;
}

export async function createRecurring(input: CreateRecurringInput): Promise<void> {
  await apiClient.post("/recurring", input);
}

export async function updateRecurring(id: string, updates: UpdateRecurringInput): Promise<void> {
  await apiClient.patch(`/recurring/${id}`, updates);
}

export async function deleteRecurring(id: string): Promise<void> {
  await apiClient.delete(`/recurring/${id}`);
}

export async function runRecurringNow(id: string): Promise<{ generated: number }> {
  const res = await apiClient.post<{ generated: number }>(`/recurring/${id}/run-now`);
  return res.data;
}
