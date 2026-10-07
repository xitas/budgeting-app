import request from "supertest";
import type { BackupFile } from "shared";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { Transaction } from "../models/Transaction";
import { clearMail, signUpAndLogin, type SignedUp } from "./helpers";
import { clearTestDb, startTestDb, stopTestDb } from "./testDb";

const app = createApp();

beforeAll(async () => {
  await startTestDb();
});

afterEach(async () => {
  clearMail();
  await clearTestDb();
});

afterAll(async () => {
  await stopTestDb();
});

interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
}

// An account using every kind of record: custom category, manual and
// recurring-generated transactions, a budget, a loan with a repayment and a
// written-off loan, an inactive rule, and a non-default currency.
async function fillAccount(user: SignedUp): Promise<void> {
  const { auth } = user;
  const post = async (path: string, body: object) => {
    const res = await request(app).post(path).set(auth).send(body);
    expect(res.status).toBeLessThan(300);
    return res.body;
  };
  await request(app).patch("/api/account/profile").set(auth).send({ currency: "GBP" });
  const custom = (await post("/api/categories", { name: "Pets", type: "expense", color: "#123456" })).category as Category;
  const cats = (await request(app).get("/api/categories").set(auth)).body.categories as Category[];
  const salary = cats.find((c) => c.name === "Salary")!;

  await post("/api/transactions", { category: custom.id, type: "expense", amountCents: 4250, description: 'Vet, "check-up"', date: "2026-07-03" });
  await post("/api/transactions", { category: salary.id, type: "income", amountCents: 320000, description: "July pay", date: "2026-07-01" });
  await post("/api/budgets", { category: custom.id, limitCents: 10000, month: 7, year: 2026 });
  const rule = (await post("/api/recurring", { category: salary.id, type: "income", amountCents: 1000, description: "Allowance", frequency: "weekly", interval: 1, startDate: "2026-07-01", endDate: "2026-07-22" })).recurring;
  await post(`/api/recurring/${rule.id}/run-now`, {});
  await request(app).patch(`/api/recurring/${rule.id}`).set(auth).send({ isActive: false });
  const loan = (await post("/api/loans", { counterparty: "Alex", direction: "lent", principalCents: 40000, date: "2026-07-05" })).loan;
  await post(`/api/loans/${loan.id}/repayments`, { amountCents: 15000, date: "2026-07-20", note: "first half" });
  const bad = (await post("/api/loans", { counterparty: "Sam", direction: "borrowed", principalCents: 9999, date: "2026-07-06" })).loan;
  await request(app).patch(`/api/loans/${bad.id}`).set(auth).send({ writtenOff: true });
}

// Content only: ids replaced by what they point at, so two exports of the
// same data compare equal even though every id differs.
function normalize(b: BackupFile) {
  const catName = new Map(b.categories.map((c) => [c.id, `${c.type}:${c.name}`]));
  const txKey = new Map(b.transactions.map((t) => [t.id, `${t.date}|${t.amountCents}|${t.description}`]));
  const ruleKey = new Map(b.recurring.map((r) => [r.id, r.description]));
  const loanKey = new Map(b.loans.map((l) => [l.id, l.counterparty]));
  return {
    settings: b.settings.currency,
    categories: b.categories.map(({ id, ...c }) => c).sort((x, y) => `${x.type}${x.name}`.localeCompare(`${y.type}${y.name}`)),
    transactions: b.transactions
      .map(({ id, categoryId, recurringId, loanId, ...t }) => ({ ...t, category: catName.get(categoryId), rule: recurringId && ruleKey.get(recurringId), loan: loanId && loanKey.get(loanId) }))
      .sort((x, y) => `${x.date}${x.amountCents}${x.description}`.localeCompare(`${y.date}${y.amountCents}${y.description}`)),
    budgets: b.budgets.map(({ id, categoryId, ...x }) => ({ ...x, category: catName.get(categoryId) })),
    recurring: b.recurring.map(({ id, categoryId, ...r }) => ({ ...r, category: catName.get(categoryId) })),
    loans: b.loans
      .map(({ id, transactionId, repayments, ...l }) => ({ ...l, tx: txKey.get(transactionId), repayments: repayments.map(({ transactionId: t, ...r }) => ({ ...r, tx: txKey.get(t) })) }))
      .sort((x, y) => x.counterparty.localeCompare(y.counterparty)),
  };
}

const exportFrom = async (user: SignedUp) => (await request(app).get("/api/account/backup").set(user.auth)).body as BackupFile;

describe("full-data backup", () => {
  it("round-trips everything into an empty account", async () => {
    const alice = await signUpAndLogin(app, "alice@example.com");
    await fillAccount(alice);

    const res = await request(app).get("/api/account/backup").set(alice.auth);
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="budget-backup-\d{4}-\d{2}-\d{2}\.json"$/);
    const backup = res.body as BackupFile;
    expect(backup).toMatchObject({ format: "budget-app-backup", version: 1, settings: { currency: "GBP" } });
    expect(backup.transactions.some((t) => t.recurringId)).toBe(true);
    expect(backup.loans.find((l) => l.counterparty === "Alex")!.repayments).toHaveLength(1);

    const bob = await signUpAndLogin(app, "bob@example.com");
    const preview = await request(app).post("/api/account/backup/preview").set(bob.auth).send({ backup });
    expect(preview.status).toBe(200);
    expect(preview.body.accountHasData).toBe(false); // only default categories
    expect(preview.body.summary).toMatchObject({
      version: 1,
      currency: "GBP",
      // 8 defaults + Pets + the Loan Out / Loan In categories loans create
      counts: { categories: 11, budgets: 1, recurring: 1, loans: 2, repayments: 1, transactions: backup.transactions.length },
      dateRange: { from: expect.stringMatching(/^2026-07-01/), to: expect.stringMatching(/^2026-07-/) },
    });

    const imported = await request(app).post("/api/account/backup/import").set(bob.auth).send({ backup, replaceExisting: false });
    expect(imported.status).toBe(200);

    const again = await exportFrom(bob);
    expect(normalize(again)).toEqual(normalize(backup));
    expect((await request(app).get("/api/auth/me").set(bob.auth)).body.user.currency).toBe("GBP");

    // Same numbers everywhere: dashboard and loan balances.
    const sum = (u: SignedUp) => request(app).get("/api/dashboard/summary?month=7&year=2026").set(u.auth);
    expect((await sum(bob)).body).toEqual((await sum(alice)).body);
    const bobLoans = (await request(app).get("/api/loans").set(bob.auth)).body.loans;
    expect(bobLoans.find((l: { counterparty: string }) => l.counterparty === "Alex")).toMatchObject({ repaidCents: 15000, outstandingCents: 25000 });
    // Imported loan transactions still belong to their loan (edits stay blocked).
    const loanTx = await Transaction.findOne({ user: bob.userId, source: "loan" });
    expect((await request(app).patch(`/api/transactions/${loanTx!.id}`).set(bob.auth).send({ amountCents: 1 })).status).toBe(409);
  });

  it("only replaces existing data when told to", async () => {
    const alice = await signUpAndLogin(app, "alice2@example.com");
    await fillAccount(alice);
    const backup = await exportFrom(alice);

    const carol = await signUpAndLogin(app, "carol@example.com");
    const cats = (await request(app).get("/api/categories").set(carol.auth)).body.categories as Category[];
    await request(app).post("/api/transactions").set(carol.auth).send({ category: cats[0].id, type: cats[0].type, amountCents: 777, date: "2026-08-01" });

    expect((await request(app).post("/api/account/backup/preview").set(carol.auth).send({ backup })).body.accountHasData).toBe(true);
    const refused = await request(app).post("/api/account/backup/import").set(carol.auth).send({ backup });
    expect(refused.status).toBe(409);
    expect(await Transaction.countDocuments({ user: carol.userId, amountCents: 777 })).toBe(1);

    const replaced = await request(app).post("/api/account/backup/import").set(carol.auth).send({ backup, replaceExisting: true });
    expect(replaced.status).toBe(200);
    expect(await Transaction.countDocuments({ user: carol.userId, amountCents: 777 })).toBe(0);
    expect(normalize(await exportFrom(carol))).toEqual(normalize(backup));
  });

  it("rejects broken files with reasons, and changes nothing", async () => {
    const alice = await signUpAndLogin(app, "alice3@example.com");
    await fillAccount(alice);
    const backup = await exportFrom(alice);
    const before = normalize(await exportFrom(alice));
    const tryImport = (b: unknown) => request(app).post("/api/account/backup/import").set(alice.auth).send({ backup: b, replaceExisting: true });

    expect((await tryImport({ hello: "world" })).body.message).toMatch(/not a budget-app-backup file/);
    expect((await tryImport({ ...backup, version: 99 })).body.message).toMatch(/newer version of the app/);
    expect((await tryImport({ ...backup, transactions: [{ ...backup.transactions[0], amountCents: 12.5 }] })).body.message).toMatch(/amountCents/);
    expect((await tryImport({ ...backup, transactions: [{ ...backup.transactions[0], categoryId: "missing" }, ...backup.transactions.slice(1)] })).body.message).toMatch(/category that isn't in the file/);
    expect((await tryImport({ ...backup, loans: [] })).body.message).toMatch(/missing loan/);
    expect((await tryImport({ ...backup, settings: { ...backup.settings, currency: "JPY" } })).status).toBe(400);

    expect(normalize(await exportFrom(alice))).toEqual(before);
  });

  it("requires sign-in", async () => {
    expect((await request(app).get("/api/account/backup")).status).toBe(401);
    expect((await request(app).post("/api/account/backup/import").send({ backup: {} })).status).toBe(401);
  });
});
