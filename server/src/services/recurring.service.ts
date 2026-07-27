import { Types } from "mongoose";
import type { RecurringFrequency, TransactionType } from "shared";
import { Category } from "../models/Category";
import { RecurringTransaction, RecurringTransactionDocument } from "../models/RecurringTransaction";
import { Transaction } from "../models/Transaction";
import { AppError } from "../utils/AppError";
import { CreateRecurringInput, UpdateRecurringInput } from "../validation/recurring.validation";

interface GeneratedTransactionRow {
  user: Types.ObjectId;
  category: Types.ObjectId;
  amount: number;
  type: TransactionType;
  description: string;
  date: Date;
  source: "recurring";
  recurringSourceId: Types.ObjectId;
}

function nextOccurrence(date: Date, frequency: RecurringFrequency, interval: number): Date {
  const next = new Date(date);
  switch (frequency) {
    case "daily":
      next.setUTCDate(next.getUTCDate() + interval);
      break;
    case "weekly":
      next.setUTCDate(next.getUTCDate() + interval * 7);
      break;
    case "monthly":
      next.setUTCMonth(next.getUTCMonth() + interval);
      break;
  }
  return next;
}

// Generates every Transaction occurrence between the template's generation
// cursor and `upTo`, then advances the cursor. Idempotent by construction:
// re-running with the same or later `upTo` never re-creates an occurrence,
// since the cursor always starts strictly after the last one generated.
export async function generateDueTransactions(recurring: RecurringTransactionDocument, upTo: Date): Promise<number> {
  if (!recurring.isActive) {
    return 0;
  }

  let cursor = recurring.lastGeneratedDate
    ? nextOccurrence(recurring.lastGeneratedDate, recurring.frequency, recurring.interval)
    : recurring.startDate;

  const rows: GeneratedTransactionRow[] = [];
  let lastGenerated = recurring.lastGeneratedDate ?? null;

  while (cursor <= upTo && (!recurring.endDate || cursor <= recurring.endDate)) {
    rows.push({
      user: recurring.user,
      category: recurring.category,
      amount: recurring.amount,
      type: recurring.type,
      description: recurring.description,
      date: cursor,
      source: "recurring",
      recurringSourceId: recurring._id,
    });
    lastGenerated = cursor;
    cursor = nextOccurrence(cursor, recurring.frequency, recurring.interval);
  }

  if (rows.length > 0) {
    await Transaction.insertMany(rows);
    recurring.lastGeneratedDate = lastGenerated!;
    await recurring.save();
  }

  return rows.length;
}

export async function runDueForUser(userId: string, upTo: Date = new Date()): Promise<void> {
  const active = await RecurringTransaction.find({ user: userId, isActive: true });
  for (const recurring of active) {
    await generateDueTransactions(recurring, upTo);
  }
}

// Used by the daily cron job — iterates every user's active recurring
// transactions, not just one user's.
export async function runDueForAll(upTo: Date = new Date()): Promise<void> {
  const active = await RecurringTransaction.find({ isActive: true });
  for (const recurring of active) {
    await generateDueTransactions(recurring, upTo);
  }
}

export async function listRecurring(userId: string): Promise<RecurringTransactionDocument[]> {
  return RecurringTransaction.find({ user: userId })
    .sort({ createdAt: -1 })
    .populate("category", "name color type");
}

export async function createRecurring(
  userId: string,
  input: CreateRecurringInput
): Promise<RecurringTransactionDocument> {
  const category = await Category.findOne({ _id: input.category, user: userId });
  if (!category) {
    throw new AppError(400, "Invalid category");
  }

  const recurring = await RecurringTransaction.create({ ...input, user: userId });
  return recurring.populate("category", "name color type");
}

export async function updateRecurring(
  userId: string,
  recurringId: string,
  updates: UpdateRecurringInput
): Promise<RecurringTransactionDocument> {
  const recurring = await RecurringTransaction.findOne({ _id: recurringId, user: userId });
  if (!recurring) {
    throw new AppError(404, "Recurring transaction not found");
  }
  Object.assign(recurring, updates);
  await recurring.save();
  return recurring.populate("category", "name color type");
}

export async function deleteRecurring(userId: string, recurringId: string): Promise<void> {
  const recurring = await RecurringTransaction.findOne({ _id: recurringId, user: userId });
  if (!recurring) {
    throw new AppError(404, "Recurring transaction not found");
  }
  await recurring.deleteOne();
}

export async function runNow(userId: string, recurringId: string): Promise<number> {
  const recurring = await RecurringTransaction.findOne({ _id: recurringId, user: userId });
  if (!recurring) {
    throw new AppError(404, "Recurring transaction not found");
  }
  return generateDueTransactions(recurring, new Date());
}
