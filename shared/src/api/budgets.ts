import type { Cents } from "../money";

export interface BudgetCategoryRef {
  id: string;
  name: string;
  color: string;
}

export interface Budget {
  id: string;
  category: BudgetCategoryRef;
  limitCents: Cents;
  month: number;
  year: number;
  spentCents: Cents;
  remainingCents: Cents;
}

export interface CreateBudgetInput {
  category: string;
  limitCents: Cents;
  month: number;
  year: number;
}

export interface UpdateBudgetInput {
  limitCents: Cents;
}
