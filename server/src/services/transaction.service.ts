import { FilterQuery } from "mongoose";
import { Category } from "../models/Category";
import { ITransaction, Transaction, TransactionDocument } from "../models/Transaction";
import { runDueForUser } from "./recurring.service";
import { AppError } from "../utils/AppError";
import { toCsv } from "../utils/csv";
import {
  CreateTransactionInput,
  ExportTransactionsQuery,
  ListTransactionsQuery,
  UpdateTransactionInput,
} from "../validation/transaction.validation";

type TransactionFilterQuery = Pick<ListTransactionsQuery, "from" | "to" | "category" | "type">;

const CATEGORY_POPULATE_FIELDS = "name color type";

export interface PaginatedTransactions {
  items: TransactionDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Shared by the paginated list and the CSV export, so an export always
// contains exactly what the same filters show on screen.
function buildTransactionFilter(userId: string, query: TransactionFilterQuery): FilterQuery<ITransaction> {
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
  return filter;
}

export async function listTransactions(userId: string, query: ListTransactionsQuery): Promise<PaginatedTransactions> {
  // Catch-up: generates anything a recurring rule owes as of today before
  // reading, so results are never stale even if the cron job (or the server
  // itself) wasn't running when an occurrence was due.
  await runDueForUser(userId);

  const filter = buildTransactionFilter(userId, query);

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

// Loan.principal/repayment amounts are a derived invariant tied to their
// linked transaction's amount — editing/deleting that transaction directly
// would desync a Loan's outstanding balance from reality with no path back.
// Recurring-sourced transactions aren't guarded the same way: a recurring
// instance has no aggregate invariant riding on it, so editing one directly
// is harmless and stays unrestricted.
function assertNotLoanSourced(transaction: TransactionDocument): void {
  if (transaction.source === "loan") {
    throw new AppError(409, "This transaction was created by a loan — edit or delete it from the Loans tab instead.");
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
  assertNotLoanSourced(transaction);

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
  assertNotLoanSourced(transaction);
  await transaction.deleteOne();
}

const CSV_HEADERS = ["Date", "Type", "Category", "Description", "Amount", "Source"];

// Whole filtered history, oldest first (the natural order for a
// spreadsheet), with the category joined in by name.
export async function exportTransactionsCsv(userId: string, query: ExportTransactionsQuery): Promise<string> {
  await runDueForUser(userId);

  const transactions = await Transaction.find(buildTransactionFilter(userId, query))
    .sort({ date: 1, _id: 1 })
    .populate<{ category: { name: string } | null }>("category", "name")
    .lean();

  const rows = transactions.map((tx) => [
    tx.date.toISOString().slice(0, 10),
    tx.type,
    tx.category?.name ?? "",
    tx.description ?? "",
    tx.amount,
    tx.source,
  ]);
  return toCsv(CSV_HEADERS, rows);
}
