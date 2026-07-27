import { FilterQuery } from "mongoose";
import { Category } from "../models/Category";
import { ITransaction, Transaction, TransactionDocument } from "../models/Transaction";
import { runDueForUser } from "./recurring.service";
import { AppError } from "../utils/AppError";
import { CreateTransactionInput, ListTransactionsQuery, UpdateTransactionInput } from "../validation/transaction.validation";

const CATEGORY_POPULATE_FIELDS = "name color type";

export interface PaginatedTransactions {
  items: TransactionDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function listTransactions(userId: string, query: ListTransactionsQuery): Promise<PaginatedTransactions> {
  // Catch-up: generates anything a recurring rule owes as of today before
  // reading, so results are never stale even if the cron job (or the server
  // itself) wasn't running when an occurrence was due.
  await runDueForUser(userId);

  const filter: FilterQuery<ITransaction> = { user: userId };

  if (query.category) {
    filter.category = query.category;
  }
  if (query.type) {
    filter.type = query.type;
  }
  if (query.from || query.to) {
    filter.date = {};
    if (query.from) {
      filter.date.$gte = new Date(query.from);
    }
    if (query.to) {
      filter.date.$lte = new Date(query.to);
    }
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Transaction.find(filter).sort({ date: -1 }).skip(skip).limit(limit).populate("category", CATEGORY_POPULATE_FIELDS),
    Transaction.countDocuments(filter),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function assertCategoryOwnedByUser(userId: string, categoryId: string): Promise<void> {
  const category = await Category.findOne({ _id: categoryId, user: userId });
  if (!category) {
    throw new AppError(400, "Invalid category");
  }
}

export async function createTransaction(userId: string, input: CreateTransactionInput): Promise<TransactionDocument> {
  await assertCategoryOwnedByUser(userId, input.category);
  const transaction = await Transaction.create({ ...input, user: userId, source: "manual" });
  return transaction.populate("category", CATEGORY_POPULATE_FIELDS);
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  updates: UpdateTransactionInput
): Promise<TransactionDocument> {
  const transaction = await Transaction.findOne({ _id: transactionId, user: userId });
  if (!transaction) {
    throw new AppError(404, "Transaction not found");
  }

  if (updates.category) {
    await assertCategoryOwnedByUser(userId, updates.category);
  }

  Object.assign(transaction, updates);
  await transaction.save();
  return transaction.populate("category", CATEGORY_POPULATE_FIELDS);
}

export async function deleteTransaction(userId: string, transactionId: string): Promise<void> {
  const transaction = await Transaction.findOne({ _id: transactionId, user: userId });
  if (!transaction) {
    throw new AppError(404, "Transaction not found");
  }
  await transaction.deleteOne();
}
