import { apiClient } from "../../lib/apiClient";
import type {
  CreateTransactionInput,
  PaginatedTransactions,
  Transaction,
  TransactionFilters,
  UpdateTransactionInput,
} from "./types";

export async function listTransactions(filters: TransactionFilters): Promise<PaginatedTransactions> {
  const res = await apiClient.get<PaginatedTransactions>("/transactions", { params: filters });
  return res.data;
}

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const res = await apiClient.post<{ transaction: Transaction }>("/transactions", input);
  return res.data.transaction;
}

export async function updateTransaction(id: string, updates: UpdateTransactionInput): Promise<Transaction> {
  const res = await apiClient.patch<{ transaction: Transaction }>(`/transactions/${id}`, updates);
  return res.data.transaction;
}

export async function deleteTransaction(id: string): Promise<void> {
  await apiClient.delete(`/transactions/${id}`);
}
