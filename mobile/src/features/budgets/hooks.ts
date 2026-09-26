import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateBudgetInput, UpdateBudgetInput } from "shared";
import * as api from "./api";

const BUDGETS_KEY = "budgets";

export function useBudgets(month: number, year: number) {
  return useQuery({
    queryKey: [BUDGETS_KEY, month, year],
    queryFn: () => api.listBudgets(month, year),
  });
}

// Budgets feed the dashboard's budget-vs-actual chart too.
function invalidateBudgets(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [BUDGETS_KEY] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
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
