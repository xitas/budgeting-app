import { Types } from "mongoose";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  CURRENCY_CODES,
  type BackupFile,
  type BackupPreviewResponse,
  type BackupSummary,
} from "shared";
import { z } from "zod";
import { Budget } from "../models/Budget";
import { Category } from "../models/Category";
import { Loan } from "../models/Loan";
import { RecurringTransaction } from "../models/RecurringTransaction";
import { Transaction } from "../models/Transaction";
import { User } from "../models/User";
import { AppError } from "../utils/AppError";
import { withTransaction } from "../utils/withTransaction";
import { deleteUserData } from "./account.service";

// Full-data backup (format in shared/src/api/backup.ts).

// ------------------------------------------------------------------ export

const iso = (d: Date | undefined | null): string | undefined => (d ? d.toISOString() : undefined);

export async function exportBackup(userId: string): Promise<BackupFile> {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, "User not found");
  const [categories, transactions, budgets, recurring, loans] = await Promise.all([
    Category.find({ user: userId }).sort({ type: 1, name: 1 }).lean(),
    Transaction.find({ user: userId }).sort({ date: 1, _id: 1 }).lean(),
    Budget.find({ user: userId }).sort({ year: 1, month: 1 }).lean(),
    RecurringTransaction.find({ user: userId }).sort({ startDate: 1 }).lean(),
    Loan.find({ user: userId }).sort({ date: 1 }).lean(),
  ]);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: { name: user.name, currency: user.currency },
    categories: categories.map((c) => ({ id: String(c._id), name: c.name, type: c.type, color: c.color, isDefault: c.isDefault })),
    transactions: transactions.map((t) => ({
      id: String(t._id),
      categoryId: String(t.category),
      type: t.type,
      amountCents: t.amountCents,
      description: t.description ?? "",
      date: t.date.toISOString(),
      source: t.source,
      ...(t.recurringSourceId ? { recurringId: String(t.recurringSourceId) } : {}),
      ...(t.loanSourceId ? { loanId: String(t.loanSourceId) } : {}),
    })),
    budgets: budgets.map((b) => ({ id: String(b._id), categoryId: String(b.category), limitCents: b.limitCents, month: b.month, year: b.year })),
    recurring: recurring.map((r) => ({
      id: String(r._id),
      categoryId: String(r.category),
      type: r.type,
      amountCents: r.amountCents,
      description: r.description ?? "",
      frequency: r.frequency,
      interval: r.interval,
      startDate: r.startDate.toISOString(),
      ...(r.endDate ? { endDate: iso(r.endDate) } : {}),
      ...(r.lastGeneratedDate ? { lastGeneratedDate: iso(r.lastGeneratedDate) } : {}),
      isActive: r.isActive,
    })),
    loans: loans.map((l) => ({
      id: String(l._id),
      counterparty: l.counterparty,
      direction: l.direction,
      principalCents: l.principalCents,
      description: l.description ?? "",
      date: l.date.toISOString(),
      transactionId: String(l.transactionId),
      writtenOff: l.writtenOff,
      repayments: l.repayments.map((r) => ({
        amountCents: r.amountCents,
        date: r.date.toISOString(),
        ...(r.note ? { note: r.note } : {}),
        transactionId: String(r.transactionId),
      })),
    })),
  };
}

// --------------------------------------------------------------- validation

const MAX_RECORDS = 200_000;
const id = z.string().min(1).max(64);
const date = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "must be a date");
const cents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const positiveCents = cents.refine((n) => n > 0, "must be greater than 0");
const txType = z.enum(["income", "expense"]);

const backupV1 = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(1),
  exportedAt: date,
  settings: z.object({ name: z.string().max(200), currency: z.enum(CURRENCY_CODES) }),
  categories: z
    .array(z.object({ id, name: z.string().trim().min(1).max(100), type: txType, color: z.string().min(1).max(32), isDefault: z.boolean() }))
    .max(1000),
  transactions: z
    .array(
      z.object({
        id,
        categoryId: id,
        type: txType,
        amountCents: positiveCents,
        description: z.string().max(1000),
        date,
        source: z.enum(["manual", "recurring", "loan", "import"]),
        recurringId: id.optional(),
        loanId: id.optional(),
      })
    )
    .max(MAX_RECORDS),
  budgets: z
    .array(z.object({ id, categoryId: id, limitCents: positiveCents, month: z.number().int().min(1).max(12), year: z.number().int().min(2000).max(2100) }))
    .max(MAX_RECORDS),
  recurring: z
    .array(
      z.object({
        id,
        categoryId: id,
        type: txType,
        amountCents: positiveCents,
        description: z.string().max(1000),
        frequency: z.enum(["daily", "weekly", "monthly"]),
        interval: z.number().int().positive(),
        startDate: date,
        endDate: date.optional(),
        lastGeneratedDate: date.optional(),
        isActive: z.boolean(),
      })
    )
    .max(10_000),
  loans: z
    .array(
      z.object({
        id,
        counterparty: z.string().trim().min(1).max(200),
        direction: z.enum(["lent", "borrowed"]),
        principalCents: positiveCents,
        description: z.string().max(1000),
        date,
        transactionId: id,
        writtenOff: z.boolean(),
        repayments: z.array(z.object({ amountCents: positiveCents, date, note: z.string().max(1000).optional(), transactionId: id })).max(10_000),
      })
    )
    .max(10_000),
});

// Upgrades an older backup to the current version, one step at a time. When
// BACKUP_VERSION goes to 2, add `1: (b) => ({ ...b, version: 2, ... })`.
const MIGRATIONS: Record<number, (backup: Record<string, unknown>) => Record<string, unknown>> = {};

function invalid(problems: string[]): AppError {
  const shown = problems.slice(0, 10);
  const more = problems.length > shown.length ? ` (and ${problems.length - shown.length} more)` : "";
  return new AppError(400, `This isn't a valid backup file: ${shown.join("; ")}${more}`);
}

export function parseBackup(raw: unknown): BackupFile {
  if (!raw || typeof raw !== "object" || (raw as { format?: unknown }).format !== BACKUP_FORMAT) {
    throw invalid([`not a ${BACKUP_FORMAT} file`]);
  }
  let data = raw as Record<string, unknown>;
  const version = data.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) throw invalid(["missing or unknown format version"]);
  if (version > BACKUP_VERSION) {
    throw new AppError(400, `This backup was made by a newer version of the app (format ${version}; this one reads up to ${BACKUP_VERSION}). Update the app and try again.`);
  }
  for (let v = version; v < BACKUP_VERSION; v++) data = MIGRATIONS[v](data);

  const parsed = backupV1.safeParse(data);
  if (!parsed.success) {
    throw invalid(parsed.error.issues.map((i) => `${i.path.join(".") || "file"}: ${i.message}`));
  }
  const backup = parsed.data as BackupFile;

  // Cross-references: everything an id points at must be in the file, with
  // the right kind (an expense can't use an income category, and so on).
  const problems: string[] = [];
  const unique = (label: string, ids: string[]) => {
    if (new Set(ids).size !== ids.length) problems.push(`${label} ids are not unique`);
  };
  unique("category", backup.categories.map((c) => c.id));
  unique("transaction", backup.transactions.map((t) => t.id));
  unique("budget", backup.budgets.map((b) => b.id));
  unique("recurring rule", backup.recurring.map((r) => r.id));
  unique("loan", backup.loans.map((l) => l.id));

  const categoryType = new Map(backup.categories.map((c) => [c.id, c.type]));
  const names = new Set<string>();
  for (const c of backup.categories) {
    const key = `${c.type}:${c.name.toLowerCase()}`;
    if (names.has(key)) problems.push(`two ${c.type} categories are both named "${c.name}"`);
    names.add(key);
  }
  const recurringIds = new Set(backup.recurring.map((r) => r.id));
  const loanIds = new Set(backup.loans.map((l) => l.id));
  const txById = new Map(backup.transactions.map((t) => [t.id, t]));

  for (const t of backup.transactions) {
    const type = categoryType.get(t.categoryId);
    if (!type) problems.push(`transaction ${t.id} uses a category that isn't in the file`);
    else if (type !== t.type) problems.push(`transaction ${t.id} is ${t.type} but its category is ${type}`);
    if (t.recurringId && !recurringIds.has(t.recurringId)) problems.push(`transaction ${t.id} points at a missing recurring rule`);
    if (t.loanId && !loanIds.has(t.loanId)) problems.push(`transaction ${t.id} points at a missing loan`);
  }
  const budgetKeys = new Set<string>();
  for (const b of backup.budgets) {
    if (categoryType.get(b.categoryId) !== "expense") problems.push(`budget ${b.id} needs an expense category from the file`);
    const key = `${b.categoryId}:${b.year}-${b.month}`;
    if (budgetKeys.has(key)) problems.push(`two budgets for the same category and month`);
    budgetKeys.add(key);
  }
  for (const r of backup.recurring) {
    const type = categoryType.get(r.categoryId);
    if (!type) problems.push(`recurring rule ${r.id} uses a category that isn't in the file`);
    else if (type !== r.type) problems.push(`recurring rule ${r.id} is ${r.type} but its category is ${type}`);
  }
  for (const l of backup.loans) {
    for (const txId of [l.transactionId, ...l.repayments.map((r) => r.transactionId)]) {
      if (txById.get(txId)?.loanId !== l.id) problems.push(`loan ${l.id} points at a transaction that isn't linked back to it`);
    }
  }
  if (problems.length) throw invalid(problems);
  return backup;
}

export function summarize(backup: BackupFile): BackupSummary {
  const dates = backup.transactions.map((t) => t.date).sort();
  return {
    version: backup.version,
    exportedAt: backup.exportedAt,
    currency: backup.settings.currency,
    counts: {
      categories: backup.categories.length,
      transactions: backup.transactions.length,
      budgets: backup.budgets.length,
      recurring: backup.recurring.length,
      loans: backup.loans.length,
      repayments: backup.loans.reduce((n, l) => n + l.repayments.length, 0),
    },
    dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
  };
}

// "Has data" means something the user made: any transaction, budget, rule or
// loan, or a category beyond the defaults every new account starts with.
export async function accountHasData(userId: string): Promise<boolean> {
  const [tx, budgets, recurring, loans, custom] = await Promise.all([
    Transaction.exists({ user: userId }),
    Budget.exists({ user: userId }),
    RecurringTransaction.exists({ user: userId }),
    Loan.exists({ user: userId }),
    Category.exists({ user: userId, isDefault: { $ne: true } }),
  ]);
  return Boolean(tx || budgets || recurring || loans || custom);
}

export async function previewBackup(userId: string, raw: unknown): Promise<BackupPreviewResponse> {
  const backup = parseBackup(raw);
  return { summary: summarize(backup), accountHasData: await accountHasData(userId) };
}

// ------------------------------------------------------------------ import

// Replaces the account's data with the backup's, all in one transaction —
// on any error nothing changes. Records get new ids; links between them are
// carried over. The display currency comes from the backup; the name and
// sign-in details stay the account's own.
export async function importBackup(userId: string, raw: unknown, replaceExisting: boolean): Promise<BackupSummary> {
  const backup = parseBackup(raw);
  if (!replaceExisting && (await accountHasData(userId))) {
    throw new AppError(409, "This account already has data. Confirm that the backup should replace it.");
  }

  const newId = new Map<string, Types.ObjectId>();
  const map = (oldId: string): Types.ObjectId => {
    let next = newId.get(oldId);
    if (!next) {
      next = new Types.ObjectId();
      newId.set(oldId, next);
    }
    return next;
  };
  // Ids are only unique per kind in the file, so namespace them.
  const cat = (i: string) => map(`c:${i}`);
  const tx = (i: string) => map(`t:${i}`);
  const rec = (i: string) => map(`r:${i}`);
  const loan = (i: string) => map(`l:${i}`);

  await withTransaction(async (session) => {
    await deleteUserData(userId, session);
    await User.updateOne({ _id: userId }, { $set: { currency: backup.settings.currency } }, { session });

    await Category.insertMany(
      backup.categories.map((c) => ({ _id: cat(c.id), user: userId, name: c.name, type: c.type, color: c.color, isDefault: c.isDefault })),
      { session }
    );
    await RecurringTransaction.insertMany(
      backup.recurring.map((r) => ({
        _id: rec(r.id),
        user: userId,
        category: cat(r.categoryId),
        amountCents: r.amountCents,
        type: r.type,
        description: r.description,
        frequency: r.frequency,
        interval: r.interval,
        startDate: new Date(r.startDate),
        endDate: r.endDate ? new Date(r.endDate) : undefined,
        lastGeneratedDate: r.lastGeneratedDate ? new Date(r.lastGeneratedDate) : undefined,
        isActive: r.isActive,
      })),
      { session }
    );
    await Loan.insertMany(
      backup.loans.map((l) => ({
        _id: loan(l.id),
        user: userId,
        counterparty: l.counterparty,
        direction: l.direction,
        principalCents: l.principalCents,
        description: l.description,
        date: new Date(l.date),
        transactionId: tx(l.transactionId),
        writtenOff: l.writtenOff,
        repayments: l.repayments.map((r) => ({ amountCents: r.amountCents, date: new Date(r.date), note: r.note, transactionId: tx(r.transactionId) })),
      })),
      { session }
    );
    await Transaction.insertMany(
      backup.transactions.map((t) => ({
        _id: tx(t.id),
        user: userId,
        category: cat(t.categoryId),
        amountCents: t.amountCents,
        type: t.type,
        description: t.description,
        date: new Date(t.date),
        source: t.source,
        recurringSourceId: t.recurringId ? rec(t.recurringId) : undefined,
        loanSourceId: t.loanId ? loan(t.loanId) : undefined,
      })),
      { session }
    );
    await Budget.insertMany(
      backup.budgets.map((b) => ({ user: userId, category: cat(b.categoryId), limitCents: b.limitCents, month: b.month, year: b.year })),
      { session }
    );
  });

  return summarize(backup);
}
