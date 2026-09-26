import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import type { PaginatedTransactions, Transaction, TransactionFilters, UpdateTransactionInput } from "shared";
import { invalidateMoneyViews } from "../../lib/queryKeys";
import * as api from "./api";

const TRANSACTIONS_KEY = "transactions";
const PAGE_SIZE = 20;

type Filters = Omit<TransactionFilters, "page" | "limit">;

// Mobile scrolls instead of paging: each page the server returns is appended
// as the list nears its end.
export function useInfiniteTransactions(filters: Filters) {
  return useInfiniteQuery({
    queryKey: [TRANSACTIONS_KEY, "infinite", filters],
    queryFn: ({ pageParam }) => api.listTransactions({ ...filters, page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}

// There's no GET /transactions/:id, so the edit screen reads the row from
// whichever loaded list page already holds it.
export function findCachedTransaction(queryClient: QueryClient, id: string): Transaction | undefined {
  const cached = queryClient.getQueriesData<InfiniteData<PaginatedTransactions>>({ queryKey: [TRANSACTIONS_KEY] });
  for (const [, data] of cached) {
    for (const page of data?.pages ?? []) {
      const match = page.items.find((tx) => tx.id === id);
      if (match) return match;
    }
  }
  return undefined;
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createTransaction,
    onSuccess: () => invalidateMoneyViews(queryClient),
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateTransactionInput }) => api.updateTransaction(id, updates),
    onSuccess: () => invalidateMoneyViews(queryClient),
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteTransaction,
    onSuccess: () => invalidateMoneyViews(queryClient),
  });
}
