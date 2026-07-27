import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Category } from "../models/Category";
import { RecurringTransaction } from "../models/RecurringTransaction";
import { Transaction } from "../models/Transaction";
import { User } from "../models/User";
import { generateDueTransactions } from "../services/recurring.service";
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

async function createUser() {
  const user = new User({ email: "recur@example.com", name: "Recur Test" });
  (user as unknown as { password: string }).password = "password123";
  await user.save();
  return user;
}

describe("recurring transaction generation", () => {
  it("generates one occurrence per day up to 'upTo' and is idempotent on repeat", async () => {
    const user = await createUser();
    const category = await Category.create({ user: user._id, name: "Salary", type: "income", color: "#4a3aa7" });
    const recurring = await RecurringTransaction.create({
      user: user._id,
      category: category._id,
      amount: 50,
      type: "income",
      description: "test",
      frequency: "daily",
      interval: 1,
      startDate: new Date("2026-01-01T00:00:00Z"),
      isActive: true,
    });

    const upTo = new Date("2026-01-04T00:00:00Z");
    const firstRunCount = await generateDueTransactions(recurring, upTo);
    expect(firstRunCount).toBe(4); // Jan 1, 2, 3, 4

    const generated = await Transaction.find({ recurringSourceId: recurring._id });
    expect(generated).toHaveLength(4);

    const secondRunCount = await generateDueTransactions(recurring, upTo);
    expect(secondRunCount).toBe(0);
    const generatedAfterRerun = await Transaction.find({ recurringSourceId: recurring._id });
    expect(generatedAfterRerun).toHaveLength(4);
  });

  it("advances by the given interval (every 2 weeks)", async () => {
    const user = await createUser();
    const category = await Category.create({ user: user._id, name: "Freelance", type: "income", color: "#e34948" });
    const recurring = await RecurringTransaction.create({
      user: user._id,
      category: category._id,
      amount: 200,
      type: "income",
      description: "",
      frequency: "weekly",
      interval: 2,
      startDate: new Date("2026-01-01T00:00:00Z"),
      isActive: true,
    });

    const count = await generateDueTransactions(recurring, new Date("2026-01-29T00:00:00Z"));
    // Jan 1, 15, 29 — every 2 weeks
    expect(count).toBe(3);
    const dates = (await Transaction.find({ recurringSourceId: recurring._id }).sort({ date: 1 })).map((t) =>
      t.date.toISOString().slice(0, 10)
    );
    expect(dates).toEqual(["2026-01-01", "2026-01-15", "2026-01-29"]);
  });

  it("does not generate anything for a paused (isActive: false) rule", async () => {
    const user = await createUser();
    const category = await Category.create({ user: user._id, name: "Salary", type: "income", color: "#4a3aa7" });
    const recurring = await RecurringTransaction.create({
      user: user._id,
      category: category._id,
      amount: 50,
      type: "income",
      description: "",
      frequency: "daily",
      interval: 1,
      startDate: new Date("2026-01-01T00:00:00Z"),
      isActive: false,
    });

    const count = await generateDueTransactions(recurring, new Date("2026-01-10T00:00:00Z"));
    expect(count).toBe(0);
  });
});
