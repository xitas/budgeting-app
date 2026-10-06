import type { RecurringFrequency, TransactionType } from "../index";
import type { Cents } from "../money";

export interface RecurringCategoryRef {
  id: string;
  name: string;
  color: string;
  type: TransactionType;
}

export interface RecurringTransaction {
  id: string;
  category: RecurringCategoryRef;
  amountCents: Cents;
  type: TransactionType;
  description: string;
  frequency: RecurringFrequency;
  interval: number;
  startDate: string;
  endDate?: string;
  lastGeneratedDate?: string;
  isActive: boolean;
}

export interface CreateRecurringInput {
  category: string;
  amountCents: Cents;
  type: TransactionType;
  description?: string;
  frequency: RecurringFrequency;
  interval: number;
  startDate: string;
  endDate?: string;
}

export interface UpdateRecurringInput {
  amountCents?: Cents;
  description?: string;
  endDate?: string | null;
  isActive?: boolean;
}
