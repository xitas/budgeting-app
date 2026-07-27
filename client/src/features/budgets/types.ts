export interface BudgetCategoryRef {
  id: string;
  name: string;
  color: string;
}

export interface Budget {
  id: string;
  category: BudgetCategoryRef;
  limit: number;
  month: number;
  year: number;
  spent: number;
  remaining: number;
}

export interface CreateBudgetInput {
  category: string;
  limit: number;
  month: number;
  year: number;
}

export interface UpdateBudgetInput {
  limit: number;
}
