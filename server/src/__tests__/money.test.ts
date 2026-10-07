import request from "supertest";
import { centsFromDecimal } from "shared";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { Transaction } from "../models/Transaction";
import { signUpAndLogin } from "./helpers";
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

async function signUp(email: string): Promise<{ auth: { Authorization: string }; expense: Category; income: Category }> {
  const { auth } = await signUpAndLogin(app, email);
  const cats = await request(app).get("/api/categories").set(auth);
  const categories = cats.body.categories as Category[];
  return {
    auth,
    expense: categories.find((c) => c.type === "expense")!,
    income: categories.find((c) => c.type === "income")!,
  };
}

describe("money over the API (integer cents)", () => {
  it("rejects fractional cents, strings and the old decimal field", async () => {
    const { auth, expense } = await signUp("validate@example.com");
    const post = (body: Record<string, unknown>) =>
      request(app)
        .post("/api/transactions")
        .set(auth)
        .send({ category: expense.id, type: "expense", date: "2026-07-01", ...body });

    const fractional = await post({ amountCents: 12.5 });
    expect(fractional.status).toBe(400);
    expect(JSON.stringify(fractional.body)).toMatch(/whole number of cents/);
    expect((await post({ amountCents: "1250" })).status).toBe(400);
    expect((await post({ amount: 12.5 })).status).toBe(400); // old decimal API shape
    expect((await post({ amountCents: 0 })).status).toBe(400);

    const ok = await post({ amountCents: 1250 });
    expect(ok.status).toBe(201);
    expect(ok.body.transaction).toMatchObject({ amountCents: 1250 });
  });

  it("sums exactly: 0.10 + 0.20 is 0.30, and ten thousand 0.01s are 100.00", async () => {
    const { auth, expense } = await signUp("sums@example.com");
    const userId = (await request(app).get("/api/auth/me").set(auth)).body.user.id as string;
    const expenseOn = (date: string, amountCents: number) => ({ user: userId, category: expense.id, type: "expense", amountCents, date: new Date(date) });
    await Transaction.insertMany([
      expenseOn("2026-07-02", 10), // 0.10
      expenseOn("2026-07-03", 20), // 0.20
      ...Array.from({ length: 10_000 }, () => expenseOn("2026-08-15", 1)), // 0.01 each
    ]);

    const july = await request(app).get("/api/dashboard/summary?month=7&year=2026").set(auth);
    expect(july.body).toMatchObject({ expenseCents: 30, netCents: -30 });
    const august = await request(app).get("/api/dashboard/summary?month=8&year=2026").set(auth);
    expect(august.body.expenseCents).toBe(10_000);

    await request(app).post("/api/budgets").set(auth).send({ category: expense.id, limitCents: 30, month: 7, year: 2026 });
    const budgets = await request(app).get("/api/budgets?month=7&year=2026").set(auth);
    expect(budgets.body.budgets[0]).toMatchObject({ spentCents: 30, remainingCents: 0 }); // exactly used up, not -5.55e-17
  });

  it("keeps loan balances exact across small repayments", async () => {
    const { auth } = await signUp("loan-sums@example.com");
    const created = await request(app)
      .post("/api/loans")
      .set(auth)
      .send({ counterparty: "Alex", direction: "lent", principalCents: 30, date: "2026-07-01" });
    const id = created.body.loan.id as string;
    await request(app).post(`/api/loans/${id}/repayments`).set(auth).send({ amountCents: 10, date: "2026-07-02" });
    const after = await request(app).post(`/api/loans/${id}/repayments`).set(auth).send({ amountCents: 20, date: "2026-07-03" });
    expect(after.body.loan).toMatchObject({ repaidCents: 30, outstandingCents: 0, status: "settled" });
  });
});

describe("CSV round trip with decimal amounts", () => {
  // Minimal CSV reader for this app's own export (quoted fields, CRLF, BOM).
  function parseExport(text: string): string[][] {
    const rows: string[][] = [];
    for (const line of text.replace(/^﻿/, "").trimEnd().split("\r\n")) {
      const cells: string[] = [];
      let cell = "";
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quoted) {
          if (ch === '"' && line[i + 1] === '"') {
            cell += '"';
            i++;
          } else if (ch === '"') quoted = false;
          else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ",") {
          cells.push(cell);
          cell = "";
        } else cell += ch;
      }
      cells.push(cell);
      rows.push(cells);
    }
    return rows;
  }

  it("export -> import -> export keeps every amount to the cent", async () => {
    const alice = await signUp("csv-alice@example.com");
    const amounts = [1, 10, 20, 30, 999, 4250, 125050, 1234567];
    for (const [i, amountCents] of amounts.entries()) {
      const res = await request(app)
        .post("/api/transactions")
        .set(alice.auth)
        .send({ category: alice.expense.id, type: "expense", amountCents, description: `Item ${i}, "quoted"`, date: `2026-07-${String(i + 1).padStart(2, "0")}` });
      expect(res.status).toBe(201);
    }

    const first = await request(app).get("/api/transactions/export").set(alice.auth);
    const [header, ...rows] = parseExport(first.text);
    expect(header).toEqual(["Date", "Type", "Category", "Description", "Amount", "Source"]);
    // Normal decimals in the file.
    expect(rows.map((r) => r[4])).toEqual(["0.01", "0.10", "0.20", "0.30", "9.99", "42.50", "1250.50", "12345.67"]);

    // Import the file into another account, the way the web import does
    // (decimal text -> cents at the edge).
    const bob = await signUp("csv-bob@example.com");
    const imported = await request(app)
      .post("/api/transactions/import")
      .set(bob.auth)
      .send({
        rows: rows.map((r) => ({ date: r[0], type: r[1], description: r[3], amountCents: centsFromDecimal(Number(r[4])), category: bob.expense.id })),
      });
    expect(imported.body.imported).toBe(amounts.length);

    const second = await request(app).get("/api/transactions/export").set(bob.auth);
    const [, ...bobRows] = parseExport(second.text);
    expect(bobRows.map((r) => [r[0], r[3], r[4]])).toEqual(rows.map((r) => [r[0], r[3], r[4]]));
    expect(bobRows.every((r) => r[5] === "import")).toBe(true);
  });
});
