import type { TransactionSource, TransactionType } from "../index";
import type { Cents } from "../money";

export interface TransactionCategoryRef {
  id: string;
  name: string;
  color: string;
  type: TransactionType;
}

export interface Transaction {
  id: string;
  category: TransactionCategoryRef;
  amountCents: Cents;
  type: TransactionType;
  description: string;
  date: string;
  source: TransactionSource;
}

export interface TransactionFilters {
  from?: string;
  to?: string;
  category?: string;
  type?: TransactionType;
  page?: number;
  limit?: number;
}

export interface PaginatedTransactions {
  items: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateTransactionInput {
  category: string;
  amountCents: Cents;
  type: TransactionType;
  description?: string;
  date: string;
}

export type UpdateTransactionInput = Partial<CreateTransactionInput>;

// CSV import: rows arrive already parsed and mapped by the client.
export interface ImportTransactionRow {
  date: string; // YYYY-MM-DD
  type: TransactionType;
  amountCents: Cents;
  description: string;
  category: string;
}

export type ImportCheckRow = Omit<ImportTransactionRow, "category">;
