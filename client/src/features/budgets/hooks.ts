import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import type { CreateBudgetInput, UpdateBudgetInput } from "./types";

const BUDGETS_KEY = "budgets";

export function useBudgets(month: number, year: number) {
  return useQuery({
    queryKey: [BUDGETS_KEY, month, year],
    queryFn: () => api.listBudgets(month, year),
  });
}

function invalidateBudgets(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [BUDGETS_KEY] });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBudgetInput) => api.createBudget(input),
    onSuccess: () => invalidateBudgets(queryClient),
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateBudgetInput }) => api.updateBudget(id, updates),
    onSuccess: () => invalidateBudgets(queryClient),
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteBudget,
    onSuccess: () => invalidateBudgets(queryClient),
  });
}
