import type { TransactionType } from "shared";

export interface TransactionCategoryRef {
  id: string;
  name: string;
  color: string;
  type: TransactionType;
}

export interface Transaction {
  id: string;
  category: TransactionCategoryRef;
  amount: number;
  type: TransactionType;
  description: string;
  date: string;
  source: "manual" | "recurring";
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
  amount: number;
  type: TransactionType;
  description?: string;
  date: string;
}

export type UpdateTransactionInput = Partial<CreateTransactionInput>;
