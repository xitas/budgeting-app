import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateCategoryInput } from "shared";
import * as api from "./api";

const CATEGORIES_KEY = ["categories"];

export function useCategories() {
  return useQuery({ queryKey: CATEGORIES_KEY, queryFn: api.listCategories });
}

// A rename or recolor shows up on every transaction row, budget and chart.
function invalidateCategoryViews(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
  void queryClient.invalidateQueries({ queryKey: ["transactions"] });
  void queryClient.invalidateQueries({ queryKey: ["budgets"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  void queryClient.invalidateQueries({ queryKey: ["recurring"] });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateCategoryInput }) => api.updateCategory(id, updates),
    onSuccess: () => invalidateCategoryViews(queryClient),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  });
}
