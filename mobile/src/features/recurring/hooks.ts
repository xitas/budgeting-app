import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateRecurringInput, UpdateRecurringInput } from "shared";
import { invalidateMoneyViews } from "../../lib/queryKeys";
import * as api from "./api";

const RECURRING_KEY = "recurring";

export function useRecurring() {
  return useQuery({ queryKey: [RECURRING_KEY], queryFn: api.listRecurring });
}

function invalidateRecurring(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [RECURRING_KEY] });
}

// Creating a rule (with a past start date) or running it now can generate
// real Transaction rows.
function invalidateRecurringAndMoneyViews(queryClient: ReturnType<typeof useQueryClient>) {
  invalidateRecurring(queryClient);
  invalidateMoneyViews(queryClient);
}

export function useCreateRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRecurringInput) => api.createRecurring(input),
    onSuccess: () => invalidateRecurringAndMoneyViews(queryClient),
  });
}

export function useUpdateRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateRecurringInput }) => api.updateRecurring(id, updates),
    onSuccess: () => invalidateRecurring(queryClient),
  });
}

export function useDeleteRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteRecurring,
    onSuccess: () => invalidateRecurring(queryClient),
  });
}

export function useRunRecurringNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.runRecurringNow,
    onSuccess: () => invalidateRecurringAndMoneyViews(queryClient),
  });
}
