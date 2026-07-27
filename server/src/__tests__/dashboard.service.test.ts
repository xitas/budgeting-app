import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Category } from "../models/Category";
import { Transaction } from "../models/Transaction";
import { User } from "../models/User";
import { getSpendingByCategory, getSummary } from "../services/dashboard.service";
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
      { user: user._id, category: salary._id, amount: 3000, type: "income", description: "", date: new Date(2026, 6, 1), source: "manual" },
      { user: user._id, category: groceries._id, amount: 100, type: "expense", description: "", date: new Date(2026, 6, 5), source: "manual" },
      // different month — must be excluded from the July totals
      { user: user._id, category: groceries._id, amount: 999, type: "expense", description: "", date: new Date(2026, 5, 5), source: "manual" },
    ]);

    const summary = await getSummary(user.id, 7, 2026);
    expect(summary).toEqual({ income: 3000, expense: 100, net: 2900 });
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
        date: new Date(2026, 6, 1),
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
