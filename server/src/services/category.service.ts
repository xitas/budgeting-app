import { CATEGORICAL_PALETTE, type TransactionType } from "shared";
import { Category, CategoryDocument } from "../models/Category";
import { Transaction } from "../models/Transaction";
import { AppError } from "../utils/AppError";
import { CreateCategoryInput, UpdateCategoryInput } from "../validation/category.validation";

const DEFAULT_CATEGORIES: { name: string; type: TransactionType }[] = [
  { name: "Groceries", type: "expense" },
  { name: "Rent", type: "expense" },
  { name: "Transportation", type: "expense" },
  { name: "Dining Out", type: "expense" },
  { name: "Entertainment", type: "expense" },
  { name: "Utilities", type: "expense" },
  { name: "Salary", type: "income" },
  { name: "Freelance", type: "income" },
];

export async function seedDefaultCategories(userId: string): Promise<void> {
  await Category.insertMany(
    DEFAULT_CATEGORIES.map((c, i) => ({
      user: userId,
      name: c.name,
      type: c.type,
      color: CATEGORICAL_PALETTE[i],
      isDefault: true,
    }))
  );
}

export async function listCategories(userId: string): Promise<CategoryDocument[]> {
  return Category.find({ user: userId }).sort({ type: 1, name: 1 });
}

export async function createCategory(userId: string, input: CreateCategoryInput): Promise<CategoryDocument> {
  const existing = await Category.findOne({ user: userId, name: input.name, type: input.type });
  if (existing) {
    throw new AppError(409, "A category with this name and type already exists");
  }
  return Category.create({ ...input, user: userId, isDefault: false });
}

export async function updateCategory(
  userId: string,
  categoryId: string,
  updates: UpdateCategoryInput
): Promise<CategoryDocument> {
  const category = await Category.findOne({ _id: categoryId, user: userId });
  if (!category) {
    throw new AppError(404, "Category not found");
  }
  Object.assign(category, updates);
  await category.save();
  return category;
}

export async function deleteCategory(userId: string, categoryId: string): Promise<void> {
  const category = await Category.findOne({ _id: categoryId, user: userId });
  if (!category) {
    throw new AppError(404, "Category not found");
  }

  const inUse = await Transaction.exists({ category: categoryId });
  if (inUse) {
    throw new AppError(409, "Cannot delete a category that has transactions. Reassign or delete those transactions first.");
  }

  await category.deleteOne();
}
