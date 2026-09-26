import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AddRepaymentInput, CreateLoanInput, UpdateLoanInput } from "shared";
import { invalidateMoneyViews } from "../../lib/queryKeys";
import * as api from "./api";

const LOANS_KEY = "loans";

export function useLoans() {
  return useQuery({ queryKey: [LOANS_KEY], queryFn: api.listLoans });
}

// Loan actions create/remove real Transaction rows, so every money view
// refetches too, not just the loans list.
function invalidateLoanRelated(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: [LOANS_KEY] });
  invalidateMoneyViews(queryClient);
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
