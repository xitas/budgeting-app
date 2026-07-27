import { Types } from "mongoose";
import { Budget, BudgetDocument } from "../models/Budget";
import { Category } from "../models/Category";
import { Transaction } from "../models/Transaction";
import { AppError } from "../utils/AppError";
import { currentMonthYear } from "../utils/date";
import { CreateBudgetInput, UpdateBudgetInput } from "../validation/budget.validation";

export interface BudgetWithSpent {
  id: string;
  category: { id: string; name: string; color: string };
  limit: number;
  month: number;
  year: number;
  spent: number;
  remaining: number;
}

interface PopulatedCategory {
  _id: Types.ObjectId;
  name: string;
  color: string;
}

// $match narrows to this user's expenses in the month, $group sums them per
// category in one round trip — the "real MongoDB" alternative to fetching
// every transaction and reducing in JS.
// UTC boundaries (see dashboard.service.ts's monthRange for the full
// reasoning) — kept consistent even though this function doesn't itself
// group by calendar month, so the convention doesn't silently diverge
// across the two files that compute a "spend for month X" figure.
async function getSpentByCategory(userId: string, month: number, year: number): Promise<Map<string, number>> {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const results = await Transaction.aggregate<{ _id: Types.ObjectId; spent: number }>([
    { $match: { user: new Types.ObjectId(userId), type: "expense", date: { $gte: start, $lt: end } } },
    { $group: { _id: "$category", spent: { $sum: "$amount" } } },
  ]);

  return new Map(results.map((r) => [r._id.toString(), r.spent]));
}

export async function listBudgets(userId: string, month?: number, year?: number): Promise<BudgetWithSpent[]> {
  const resolved = month && year ? { month, year } : currentMonthYear();

  const [budgets, spentByCategory] = await Promise.all([
    Budget.find({ user: userId, month: resolved.month, year: resolved.year }).populate<{ category: PopulatedCategory }>(
      "category",
      "name color"
    ),
    getSpentByCategory(userId, resolved.month, resolved.year),
  ]);

  return budgets.map((b) => {
    const spent = spentByCategory.get(b.category._id.toString()) ?? 0;
    return {
      id: b.id,
      category: { id: b.category._id.toString(), name: b.category.name, color: b.category.color },
      limit: b.limit,
      month: b.month,
      year: b.year,
      spent,
      remaining: b.limit - spent,
    };
  });
}

export async function createBudget(userId: string, input: CreateBudgetInput): Promise<BudgetDocument> {
  const category = await Category.findOne({ _id: input.category, user: userId });
  if (!category) {
    throw new AppError(400, "Invalid category");
  }
  if (category.type !== "expense") {
    throw new AppError(400, "Budgets can only be set on expense categories");
  }

  const existing = await Budget.findOne({
    user: userId,
    category: input.category,
    month: input.month,
    year: input.year,
  });
  if (existing) {
    throw new AppError(409, "A budget for this category and month already exists");
  }

  return Budget.create({ ...input, user: userId });
}

export async function updateBudget(userId: string, budgetId: string, updates: UpdateBudgetInput): Promise<BudgetDocument> {
  const budget = await Budget.findOne({ _id: budgetId, user: userId });
  if (!budget) {
    throw new AppError(404, "Budget not found");
  }
  Object.assign(budget, updates);
  await budget.save();
  return budget;
}

export async function deleteBudget(userId: string, budgetId: string): Promise<void> {
  const budget = await Budget.findOne({ _id: budgetId, user: userId });
  if (!budget) {
    throw new AppError(404, "Budget not found");
  }
  await budget.deleteOne();
}
