import { apiClient } from "../../lib/apiClient";
import type { AddRepaymentInput, CreateLoanInput, Loan, UpdateLoanInput } from "./types";

export async function listLoans(): Promise<Loan[]> {
  const res = await apiClient.get<{ loans: Loan[] }>("/loans");
  return res.data.loans;
}

export async function createLoan(input: CreateLoanInput): Promise<void> {
  await apiClient.post("/loans", input);
}

export async function updateLoan(id: string, updates: UpdateLoanInput): Promise<void> {
  await apiClient.patch(`/loans/${id}`, updates);
}

export async function deleteLoan(id: string): Promise<void> {
  await apiClient.delete(`/loans/${id}`);
}

export async function addRepayment(id: string, input: AddRepaymentInput): Promise<void> {
  await apiClient.post(`/loans/${id}/repayments`, input);
}

export async function removeRepayment(id: string, repaymentId: string): Promise<void> {
  await apiClient.delete(`/loans/${id}/repayments/${repaymentId}`);
}
