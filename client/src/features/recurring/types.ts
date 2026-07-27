import type { RecurringFrequency, TransactionType } from "shared";

export interface RecurringCategoryRef {
  id: string;
  name: string;
  color: string;
  type: TransactionType;
}

export interface RecurringTransaction {
  id: string;
  category: RecurringCategoryRef;
  amount: number;
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
  amount: number;
  type: TransactionType;
  description?: string;
  frequency: RecurringFrequency;
  interval: number;
  startDate: string;
  endDate?: string;
}

export interface UpdateRecurringInput {
  amount?: number;
  description?: string;
  endDate?: string | null;
  isActive?: boolean;
}
