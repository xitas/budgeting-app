import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import type { TransactionFilters, UpdateTransactionInput } from "./types";

const TRANSACTIONS_KEY = "transactions";

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: [TRANSACTIONS_KEY, filters],
    queryFn: () => api.listTransactions(filters),
  });
}

function invalidateTransactions(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_KEY] });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createTransaction,
    onSuccess: () => invalidateTransactions(queryClient),
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateTransactionInput }) => api.updateTransaction(id, updates),
    onSuccess: () => invalidateTransactions(queryClient),
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteTransaction,
    onSuccess: () => invalidateTransactions(queryClient),
  });
}
