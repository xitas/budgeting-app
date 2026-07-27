import type { TransactionType } from "shared";

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon?: string;
  isDefault: boolean;
}

export interface CreateCategoryInput {
  name: string;
  type: TransactionType;
  color: string;
}

export type UpdateCategoryInput = Partial<Pick<CreateCategoryInput, "name" | "color">>;
