import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { Transaction } from "../models/Transaction";
import { clearTestDb, startTestDb, stopTestDb } from "./testDb";

const app = createApp();

beforeAll(async () => {
  await startTestDb();
});

afterEach(async () => {
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

async function signUp(email: string): Promise<{ token: string; expense: Category; income: Category }> {
  const res = await request(app).post("/api/auth/signup").send({ email, password: "password123", name: "Import Test" });
  const token = res.body.accessToken as string;
  const cats = await request(app).get("/api/categories").set("Authorization", `Bearer ${token}`);
  const categories = cats.body.categories as Category[];
  return {
    token,
    expense: categories.find((c) => c.type === "expense")!,
    income: categories.find((c) => c.type === "income")!,
  };
}

describe("POST /api/transactions/import", () => {
  it("imports rows with source 'import' and returns the count", async () => {
    const { token, expense, income } = await signUp("import@example.com");

    const res = await request(app)
      .post("/api/transactions/import")
      .set("Authorization", `Bearer ${token}`)
      .send({
        rows: [
          { date: "2026-07-01", type: "income", amount: 3000, description: "Salary", category: income.id },
          { date: "2026-07-02", type: "expense", amount: 42.5, description: "TESCO STORES", category: expense.id },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(2);
    const saved = await Transaction.find({}).sort({ date: 1 }).lean();
    expect(saved.map((t) => [t.date.toISOString().slice(0, 10), t.amount, t.source])).toEqual([
      ["2026-07-01", 3000, "import"],
      ["2026-07-02", 42.5, "import"],
    ]);
  });

  it("is all-or-nothing: one bad row rejects the whole import", async () => {
    const { token, expense, income } = await signUp("atomic@example.com");

    const res = await request(app)
      .post("/api/transactions/import")
      .set("Authorization", `Bearer ${token}`)
      .send({
        rows: [
          { date: "2026-07-01", type: "expense", amount: 10, category: expense.id },
          // an expense filed under an income category
          { date: "2026-07-02", type: "expense", amount: 20, category: income.id },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Row 2/);
    expect(await Transaction.countDocuments()).toBe(0);
  });

  it("rejects categories that belong to another user", async () => {
    const alice = await signUp("alice@example.com");
    const bob = await signUp("bob@example.com");

    const res = await request(app)
      .post("/api/transactions/import")
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ rows: [{ date: "2026-07-01", type: "expense", amount: 10, category: alice.expense.id }] });

    expect(res.status).toBe(400);
    expect(await Transaction.countDocuments()).toBe(0);
  });

  it("validates dates, amounts and malformed ids", async () => {
    const { token, expense } = await signUp("validate@example.com");
    const send = (row: Record<string, unknown>) =>
      request(app).post("/api/transactions/import").set("Authorization", `Bearer ${token}`).send({ rows: [row] });

    expect((await send({ date: "01/07/2026", type: "expense", amount: 10, category: expense.id })).status).toBe(400);
    expect((await send({ date: "2026-07-01", type: "expense", amount: -10, category: expense.id })).status).toBe(400);
    expect((await send({ date: "2026-07-01", type: "expense", amount: 10, category: "not-an-id" })).status).toBe(400);
  });

  it("accepts a large import above the default 100kb JSON limit", async () => {
    const { token, expense } = await signUp("bulk@example.com");
    const rows = Array.from({ length: 2000 }, (_, i) => ({
      date: `2026-${String((i % 12) + 1).padStart(2, "0")}-15`,
      type: "expense",
      amount: 1 + i,
      description: `Card payment #${i} at a shop with a fairly long merchant description`,
      category: expense.id,
    }));

    const res = await request(app).post("/api/transactions/import").set("Authorization", `Bearer ${token}`).send({ rows });

    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(2000);
  });

  it("returns 400, not 500, for malformed JSON", async () => {
    const { token } = await signUp("badjson@example.com");
    const res = await request(app)
      .post("/api/transactions/import")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send('{"rows": [');
    expect(res.status).toBe(400);
  });
});

describe("POST /api/transactions/import/check", () => {
  it("flags rows matching existing transactions (same day, type, amount, description)", async () => {
    const { token, expense } = await signUp("dupes@example.com");
    await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${token}`)
      .send({ category: expense.id, type: "expense", amount: 42.5, description: "Tesco  Stores", date: "2026-07-02" });

    const res = await request(app)
      .post("/api/transactions/import/check")
      .set("Authorization", `Bearer ${token}`)
      .send({
        rows: [
          { date: "2026-07-02", type: "expense", amount: 42.5, description: "TESCO STORES" }, // same (case/space-insensitive)
          { date: "2026-07-02", type: "expense", amount: 42.51, description: "TESCO STORES" }, // different amount
          { date: "2026-07-03", type: "expense", amount: 42.5, description: "TESCO STORES" }, // different day
          { date: "2026-07-02", type: "income", amount: 42.5, description: "TESCO STORES" }, // different type
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.duplicates).toEqual([0]);
  });

  it("finds a re-import of just-imported rows", async () => {
    const { token, expense } = await signUp("reimport@example.com");
    const rows = [{ date: "2026-08-31", type: "expense", amount: 9.99, description: "Streaming", category: expense.id }];
    await request(app).post("/api/transactions/import").set("Authorization", `Bearer ${token}`).send({ rows });

    const res = await request(app).post("/api/transactions/import/check").set("Authorization", `Bearer ${token}`).send({ rows });
    expect(res.body.duplicates).toEqual([0]);
  });
});
