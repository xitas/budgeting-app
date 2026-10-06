import type { LoanDirection, LoanStatus } from "../index";
import type { Cents } from "../money";

export interface Repayment {
  id: string;
  amountCents: Cents;
  date: string;
  note?: string;
  transactionId: string;
}

export interface Loan {
  id: string;
  counterparty: string;
  direction: LoanDirection;
  principalCents: Cents;
  description: string;
  date: string;
  writtenOff: boolean;
  repayments: Repayment[];
  repaidCents: Cents;
  outstandingCents: Cents;
  status: LoanStatus;
}

export interface CreateLoanInput {
  counterparty: string;
  direction: LoanDirection;
  principalCents: Cents;
  description?: string;
  date: string;
}

export interface UpdateLoanInput {
  counterparty?: string;
  principalCents?: Cents;
  description?: string;
  date?: string;
  writtenOff?: boolean;
}

export interface AddRepaymentInput {
  amountCents: Cents;
  date: string;
  note?: string;
}
