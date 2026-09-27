import { FilterQuery, Types } from "mongoose";
import { Category } from "../models/Category";
import { ITransaction, Transaction, TransactionDocument } from "../models/Transaction";
import { runDueForUser } from "./recurring.service";
import { AppError } from "../utils/AppError";
import { toCsv } from "../utils/csv";
import { withTransaction } from "../utils/withTransaction";
import {
  CreateTransactionInput,
  ExportTransactionsQuery,
  ImportCheckRow,
  ImportTransactionRow,
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

// Two rows are "the same transaction" when day, type, amount (to the cent)
// and description (case/whitespace-insensitive) all match — what a bank
// statement re-imported, or this app's own export imported back, looks like.
function duplicateKey(isoDay: string, type: string, amount: number, description: string): string {
  return [isoDay, type, Math.round(amount * 100), description.trim().replace(/\s+/g, " ").toLowerCase()].join("|");
}

// Returns the indexes of rows that match an existing transaction, so the
// import preview can untick them. Only reads the date span the file covers.
export async function findImportDuplicates(userId: string, rows: ImportCheckRow[]): Promise<number[]> {
  const days = rows.map((r) => r.date).sort();
  const from = new Date(days[0]);
  const toExclusive = new Date(new Date(days[days.length - 1]).getTime() + 24 * 60 * 60 * 1000);

  const existing = await Transaction.find(
    { user: userId, date: { $gte: from, $lt: toExclusive } },
    "date type amount description"
  ).lean();
  const keys = new Set(
    existing.map((tx) => duplicateKey(tx.date.toISOString().slice(0, 10), tx.type, tx.amount, tx.description ?? ""))
  );

  return rows.flatMap((r, i) => (keys.has(duplicateKey(r.date, r.type, r.amount, r.description ?? "")) ? [i] : []));
}

// All-or-nothing: every row is validated up front, then inserted in one
// MongoDB transaction, so a failed import never leaves half a statement.
export async function importTransactions(userId: string, rows: ImportTransactionRow[]): Promise<number> {
  const categoryIds = [...new Set(rows.map((r) => r.category))];
  const invalidId = categoryIds.find((id) => !Types.ObjectId.isValid(id));
  if (invalidId) {
    throw new AppError(400, `Unknown category: ${invalidId}`);
  }

  const categories = await Category.find({ _id: { $in: categoryIds }, user: userId }, "type").lean();
  const typeById = new Map(categories.map((c) => [c._id.toString(), c.type]));

  rows.forEach((row, i) => {
    const categoryType = typeById.get(row.category);
    if (!categoryType) {
      throw new AppError(400, `Row ${i + 1}: unknown category`);
    }
    // Categories are typed; an income filed under an expense category would
    // skew every chart that groups by category.
    if (categoryType !== row.type) {
      throw new AppError(400, `Row ${i + 1}: an ${row.type} can't use an ${categoryType} category`);
    }
  });

  const docs = rows.map((row) => ({
    user: userId,
    category: row.category,
    type: row.type,
    amount: row.amount,
    description: row.description ?? "",
    date: new Date(row.date),
    source: "import" as const,
  }));
  await withTransaction((session) => Transaction.insertMany(docs, { session }));
  return docs.length;
}
