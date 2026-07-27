import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import type { CreateRecurringInput, UpdateRecurringInput } from "./types";

const RECURRING_KEY = "recurring";

export function useRecurring() {
  return useQuery({ queryKey: [RECURRING_KEY], queryFn: api.listRecurring });
}

function invalidateRecurring(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [RECURRING_KEY] });
}

// Generation can create new Transaction rows, so the transactions list needs
// to refetch too, not just the recurring list.
function invalidateRecurringAndTransactions(queryClient: ReturnType<typeof useQueryClient>) {
  invalidateRecurring(queryClient);
  void queryClient.invalidateQueries({ queryKey: ["transactions"] });
}

export function useCreateRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRecurringInput) => api.createRecurring(input),
    onSuccess: () => invalidateRecurringAndTransactions(queryClient),
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
    onSuccess: () => invalidateRecurringAndTransactions(queryClient),
  });
}
