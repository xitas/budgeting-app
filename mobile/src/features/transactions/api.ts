import { apiClient } from "../../lib/apiClient";
import type {
  CreateTransactionInput,
  PaginatedTransactions,
  Transaction,
  TransactionFilters,
  UpdateTransactionInput,
} from "shared";

export async function listTransactions(filters: TransactionFilters): Promise<PaginatedTransactions> {
  const res = await apiClient.get<PaginatedTransactions>("/transactions", { params: filters });
  return res.data;
}

// Same filters as the list (paging ignored); the server returns CSV text.
// (The web client asks for a Blob instead, to hand to a browser download.)
export async function exportTransactionsCsv(filters: TransactionFilters): Promise<string> {
  const { from, to, category, type } = filters;
  const res = await apiClient.get<string>("/transactions/export", {
    params: { from, to, category, type },
    responseType: "text",
  });
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
