import type { LoanDirection, LoanStatus } from "shared";

export interface Repayment {
  id: string;
  amount: number;
  date: string;
  note?: string;
  transactionId: string;
}

export interface Loan {
  id: string;
  counterparty: string;
  direction: LoanDirection;
  principal: number;
  description: string;
  date: string;
  writtenOff: boolean;
  repayments: Repayment[];
  repaid: number;
  outstanding: number;
  status: LoanStatus;
}

export interface CreateLoanInput {
  counterparty: string;
  direction: LoanDirection;
  principal: number;
  description?: string;
  date: string;
}

export interface UpdateLoanInput {
  counterparty?: string;
  principal?: number;
  description?: string;
  date?: string;
  writtenOff?: boolean;
}

export interface AddRepaymentInput {
  amount: number;
  date: string;
  note?: string;
}
