import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Category } from "../models/Category";
import { Transaction } from "../models/Transaction";
import { User } from "../models/User";
import * as loanService from "../services/loan.service";
import { getIncomeVsExpenseTrend, getSpendingByCategory, getSummary } from "../services/dashboard.service";
import { clearTestDb, startTestDb, stopTestDb } from "./testDb";

beforeAll(async () => {
  await startTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await stopTestDb();
});

describe("dashboard aggregations", () => {
  it("computes income/expense/net totals for the given month only, via $facet", async () => {
    const user = await User.create({ email: "dash@example.com", name: "Dash", passwordHash: "x" });
    const salary = await Category.create({ user: user._id, name: "Salary", type: "income", color: "#4a3aa7" });
    const groceries = await Category.create({ user: user._id, name: "Groceries", type: "expense", color: "#2a78d6" });

    await Transaction.create([
      { user: user._id, category: salary._id, amount: 3000, type: "income", description: "", date: new Date("2026-07-01"), source: "manual" },
      { user: user._id, category: groceries._id, amount: 100, type: "expense", description: "", date: new Date("2026-07-05"), source: "manual" },
      // different month — must be excluded from the July totals
      { user: user._id, category: groceries._id, amount: 999, type: "expense", description: "", date: new Date("2026-06-05"), source: "manual" },
    ]);

    const summary = await getSummary(user.id, 7, 2026);
    expect(summary).toEqual({ income: 3000, expense: 100, netLending: 0, net: 2900 });
  });

  it("excludes loan-sourced transactions from income/expense tiles and spending-by-category, but reflects them in netLending/net", async () => {
    const user = await User.create({ email: "dash3@example.com", name: "Dash3", passwordHash: "x" });
    const salary = await Category.create({ user: user._id, name: "Salary", type: "income", color: "#4a3aa7" });
    await Transaction.create({
      user: user._id,
      category: salary._id,
      amount: 1000,
      type: "income",
      description: "",
      date: new Date("2026-07-01"),
      source: "manual",
    });

    // Lending 400 out this month: an expense-typed, loan-sourced transaction.
    await loanService.createLoan(user.id, {
      counterparty: "Alex",
      direction: "lent",
      principal: 400,
      description: "",
      date: new Date("2026-07-10"),
    });

    const summary = await getSummary(user.id, 7, 2026);
    expect(summary.income).toBe(1000); // unaffected by the loan
    expect(summary.expense).toBe(0); // the loan must NOT show up as ordinary expense
    expect(summary.netLending).toBe(-400); // lent 400, received 0 back
    expect(summary.net).toBe(600); // 1000 - 0 + (-400) — arithmetic closes

    const spending = await getSpendingByCategory(user.id, 7, 2026);
    expect(spending.find((s) => s.name === "Loan Out")).toBeUndefined();

    const trend = await getIncomeVsExpenseTrend(user.id, 7, 2026, 1);
    expect(trend[0]).toEqual({ month: "2026-07", income: 1000, expense: 0 });
  });

  it("sorts spending by category descending and folds the tail into Other past the top 7", async () => {
    const user = await User.create({ email: "dash2@example.com", name: "Dash2", passwordHash: "x" });
    const categories = await Category.insertMany(
      Array.from({ length: 9 }, (_, i) => ({ user: user._id, name: `Cat${i}`, type: "expense", color: "#000000" }))
    );

    await Transaction.insertMany(
      categories.map((c, i) => ({
        user: user._id,
        category: c._id,
        amount: (i + 1) * 10, // 10..90 — Cat8 is the largest, Cat0 the smallest
        type: "expense",
        description: "",
        date: new Date("2026-07-01"),
        source: "manual",
      }))
    );

    const spending = await getSpendingByCategory(user.id, 7, 2026);
    expect(spending).toHaveLength(8); // top 7 + "Other"
    expect(spending[0].amount).toBe(90);
    // 9 categories, top 7 kept (90..30) — the remaining 2 (20 + 10) fold into "Other"
    expect(spending[spending.length - 1]).toMatchObject({ name: "Other", amount: 30 });
  });
});
