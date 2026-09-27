import { apiClient } from "../../lib/apiClient";
import type {
  CreateTransactionInput,
  ImportCheckRow,
  ImportTransactionRow,
  PaginatedTransactions,
  Transaction,
  TransactionFilters,
  UpdateTransactionInput,
} from "shared";

export async function listTransactions(filters: TransactionFilters): Promise<PaginatedTransactions> {
  const res = await apiClient.get<PaginatedTransactions>("/transactions", { params: filters });
  return res.data;
}

// Same filters as the list (paging ignored); the server returns a CSV file.
export async function exportTransactionsCsv(filters: TransactionFilters): Promise<Blob> {
  const { from, to, category, type } = filters;
  const res = await apiClient.get<Blob>("/transactions/export", {
    params: { from, to, category, type },
    responseType: "blob",
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

// Indexes (into `rows`) of rows that match a transaction already saved.
export async function checkImportDuplicates(rows: ImportCheckRow[]): Promise<number[]> {
  const res = await apiClient.post<{ duplicates: number[] }>("/transactions/import/check", { rows });
  return res.data.duplicates;
}

// All-or-nothing on the server; resolves to the number of rows saved.
export async function importTransactions(rows: ImportTransactionRow[]): Promise<number> {
  const res = await apiClient.post<{ imported: number }>("/transactions/import", { rows });
  return res.data.imported;
}
