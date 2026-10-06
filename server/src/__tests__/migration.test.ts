import mongoose from "mongoose";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { migrateAmountsToCents, restoreBackup } from "../migrations/amountsToCents";
import { clearTestDb, startTestDb, stopTestDb } from "./testDb";

const app = createApp();
const db = () => mongoose.connection.db!;
const raw = (name: string) => db().collection(name);

beforeAll(async () => {
  await startTestDb();
});

afterEach(async () => {
  await clearTestDb();
  // Backup collections aren't Mongoose models, so clearTestDb leaves them.
  for (const c of await db().listCollections().toArray()) {
    if (c.name.includes("_backup_")) await db().dropCollection(c.name);
  }
});

afterAll(async () => {
  await stopTestDb();
});

async function signUp(email: string): Promise<{ token: string; userId: mongoose.Types.ObjectId; expenseId: mongoose.Types.ObjectId; incomeId: mongoose.Types.ObjectId }> {
  const res = await request(app).post("/api/auth/signup").send({ email, password: "password123", name: "Migration Test" });
  const token = res.body.accessToken as string;
  const cats = await request(app).get("/api/categories").set("Authorization", `Bearer ${token}`);
  const categories = cats.body.categories as { id: string; type: string }[];
  return {
    token,
    userId: new mongoose.Types.ObjectId(res.body.user.id as string),
    expenseId: new mongoose.Types.ObjectId(categories.find((c) => c.type === "expense")!.id),
    incomeId: new mongoose.Types.ObjectId(categories.find((c) => c.type === "income")!.id),
  };
}

// Writes documents the way the pre-cents app stored them (decimal fields),
// straight into the collections, bypassing the current schemas.
async function insertLegacyData(user: Awaited<ReturnType<typeof signUp>>): Promise<void> {
  const base = { user: user.userId, description: "", source: "manual" };
  await raw("transactions").insertMany([
    { ...base, category: user.incomeId, type: "income", amount: 3200, date: new Date("2026-07-01") },
    { ...base, category: user.expenseId, type: "expense", amount: 0.1, date: new Date("2026-07-02") },
    { ...base, category: user.expenseId, type: "expense", amount: 0.2, date: new Date("2026-07-03") },
    { ...base, category: user.expenseId, type: "expense", amount: 42.5, date: new Date("2026-07-04") },
    { ...base, category: user.expenseId, type: "expense", amount: 1250.5, date: new Date("2026-07-05") },
    // A value that was itself produced by float arithmetic in the old app.
    { ...base, category: user.expenseId, type: "expense", amount: 0.1 + 0.2, date: new Date("2026-07-06") },
  ]);
  await raw("budgets").insertOne({ user: user.userId, category: user.expenseId, limit: 1500.75, month: 7, year: 2026 });
  await raw("recurringtransactions").insertOne({
    user: user.userId,
    category: user.expenseId,
    amount: 19.99,
    type: "expense",
    description: "Streaming",
    frequency: "monthly",
    interval: 1,
    startDate: new Date("2026-09-01"),
    isActive: false,
  });
  await raw("loans").insertOne({
    user: user.userId,
    counterparty: "Alex",
    direction: "lent",
    principal: 400,
    description: "",
    date: new Date("2026-07-10"),
    transactionId: new mongoose.Types.ObjectId(),
    writtenOff: false,
    repayments: [
      { _id: new mongoose.Types.ObjectId(), amount: 0.1, date: new Date("2026-07-11"), transactionId: new mongoose.Types.ObjectId() },
      { _id: new mongoose.Types.ObjectId(), amount: 150.2, date: new Date("2026-07-12"), transactionId: new mongoose.Types.ObjectId() },
    ],
  });
}

describe("migrateAmountsToCents", () => {
  it("converts every money field to integer cents with matching totals", async () => {
    const user = await signUp("migrate@example.com");
    await insertLegacyData(user);

    const report = await migrateAmountsToCents({ backupStamp: "t1" });
    expect(report.ok).toBe(true);
    const byName = Object.fromEntries(report.collections.map((c) => [c.collection, c]));
    expect(byName.transactions).toMatchObject({ legacyDocs: 6, convertedDocs: 6, backup: "transactions_backup_t1" });
    expect(byName.transactions.totals).toEqual([{ field: "amountCents", before: "4493.60", after: "4493.60", match: true }]);
    expect(byName.loans.totals).toEqual([
      { field: "principalCents", before: "400.00", after: "400.00", match: true },
      { field: "repayments.amountCents", before: "150.30", after: "150.30", match: true },
    ]);

    const txs = await raw("transactions").find({}).sort({ date: 1 }).toArray();
    expect(txs.map((t) => t.amountCents)).toEqual([320000, 10, 20, 4250, 125050, 30]);
    expect(txs.every((t) => !("amount" in t))).toBe(true);
    expect(await raw("budgets").findOne({})).toMatchObject({ limitCents: 150075 });
    expect(await raw("recurringtransactions").findOne({})).toMatchObject({ amountCents: 1999 });
    const loan = await raw("loans").findOne({});
    expect(loan).toMatchObject({ principalCents: 40000 });
    expect(loan!.repayments.map((r: { amountCents: number }) => r.amountCents)).toEqual([10, 15020]);
    expect("principal" in loan!).toBe(false);
  });

  it("keeps a full backup of the original documents", async () => {
    const user = await signUp("backup@example.com");
    await insertLegacyData(user);
    await migrateAmountsToCents({ backupStamp: "t2" });

    const backup = await raw("transactions_backup_t2").find({}).sort({ date: 1 }).toArray();
    expect(backup.map((t) => t.amount)).toEqual([3200, 0.1, 0.2, 42.5, 1250.5, 0.1 + 0.2]);
    expect(await raw("loans_backup_t2").findOne({})).toMatchObject({ principal: 400 });
  });

  it("is safe to run twice: the second run changes nothing", async () => {
    const user = await signUp("twice@example.com");
    await insertLegacyData(user);
    await migrateAmountsToCents({ backupStamp: "t3a" });
    const afterFirst = await raw("transactions").find({}).sort({ date: 1 }).toArray();

    const second = await migrateAmountsToCents({ backupStamp: "t3b" });
    expect(second.ok).toBe(true);
    expect(second.collections.every((c) => c.legacyDocs === 0 && c.convertedDocs === 0 && !c.backup)).toBe(true);
    expect(await raw("transactions").find({}).sort({ date: 1 }).toArray()).toEqual(afterFirst);
  });

  it("dry run reports without writing or backing up", async () => {
    const user = await signUp("dry@example.com");
    await insertLegacyData(user);
    const report = await migrateAmountsToCents({ dryRun: true });
    expect(report.ok).toBe(true);
    expect(report.collections.find((c) => c.collection === "transactions")!.legacyDocs).toBe(6);
    expect(await raw("transactions").countDocuments({ amount: { $exists: true } })).toBe(6);
    expect((await db().listCollections().toArray()).some((c) => c.name.includes("_backup_"))).toBe(false);
  });

  it("stops before changing anything when a value needs sub-cent rounding", async () => {
    const user = await signUp("subcent@example.com");
    await insertLegacyData(user);
    await raw("loans").updateOne({}, { $set: { principal: 10.005 } }); // last collection processed

    await expect(migrateAmountsToCents({ backupStamp: "t4" })).rejects.toThrow(/need rounding/);
    // Not even the earlier collections were touched.
    expect(await raw("transactions").countDocuments({ amountCents: { $exists: true } })).toBe(0);

    const rounded = await migrateAmountsToCents({ backupStamp: "t4b", acceptRounding: true });
    expect(rounded.ok).toBe(true);
    expect(await raw("loans").findOne({})).toMatchObject({ principalCents: 1001 });
  });

  it("refuses invalid legacy values", async () => {
    const user = await signUp("invalid@example.com");
    await insertLegacyData(user);
    await raw("transactions").updateOne({ amount: 42.5 }, { $set: { amount: "42.50" } });
    await expect(migrateAmountsToCents({ backupStamp: "t5" })).rejects.toThrow(/not a valid amount/);
    expect(await raw("transactions").countDocuments({ amountCents: { $exists: true } })).toBe(0);
  });

  it("restoreBackup puts the original documents back", async () => {
    const user = await signUp("restore@example.com");
    await insertLegacyData(user);
    await migrateAmountsToCents({ backupStamp: "t6" });
    const restored = await restoreBackup("t6");
    expect(restored).toEqual(["transactions", "budgets", "recurringtransactions", "loans"]);
    expect(await raw("transactions").countDocuments({ amount: { $exists: true }, amountCents: { $exists: false } })).toBe(6);
  });

  it("migrated data reads back correctly through the API", async () => {
    const user = await signUp("api@example.com");
    await insertLegacyData(user);
    await migrateAmountsToCents({ backupStamp: "t7" });

    const auth = { Authorization: `Bearer ${user.token}` };
    const summary = await request(app).get("/api/dashboard/summary?month=7&year=2026").set(auth);
    // Expenses: 0.10 + 0.20 + 42.50 + 1250.50 + 0.30 = 1293.60, exactly.
    expect(summary.body).toMatchObject({ incomeCents: 320000, expenseCents: 129360, netCents: 190640 });

    const budgets = await request(app).get("/api/budgets?month=7&year=2026").set(auth);
    expect(budgets.body.budgets[0]).toMatchObject({ limitCents: 150075, spentCents: 129360, remainingCents: 20715 });

    const loans = await request(app).get("/api/loans").set(auth);
    expect(loans.body.loans[0]).toMatchObject({ principalCents: 40000, repaidCents: 15030, outstandingCents: 24970 });
  });
});
