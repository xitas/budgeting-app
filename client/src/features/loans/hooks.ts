import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import type { AddRepaymentInput, CreateLoanInput, UpdateLoanInput } from "./types";

const LOANS_KEY = "loans";

export function useLoans() {
  return useQuery({ queryKey: [LOANS_KEY], queryFn: api.listLoans });
}

// Loan actions create/remove real Transaction rows, so the transactions
// list and every dashboard chart need to refetch too, not just the loans
// list — mirrors how useRunRecurringNow already invalidates transactions.
function invalidateLoanRelated(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [LOANS_KEY] });
  void queryClient.invalidateQueries({ queryKey: ["transactions"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useCreateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLoanInput) => api.createLoan(input),
    onSuccess: () => invalidateLoanRelated(queryClient),
  });
}

export function useUpdateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateLoanInput }) => api.updateLoan(id, updates),
    onSuccess: () => invalidateLoanRelated(queryClient),
  });
}

export function useDeleteLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteLoan,
    onSuccess: () => invalidateLoanRelated(queryClient),
  });
}

export function useAddRepayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AddRepaymentInput }) => api.addRepayment(id, input),
    onSuccess: () => invalidateLoanRelated(queryClient),
  });
}

export function useRemoveRepayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, repaymentId }: { id: string; repaymentId: string }) => api.removeRepayment(id, repaymentId),
    onSuccess: () => invalidateLoanRelated(queryClient),
  });
}
