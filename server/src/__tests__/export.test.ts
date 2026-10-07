import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { toCsv } from "../utils/csv";
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

async function signUp(email: string): Promise<{ token: string; categories: { id: string; name: string; type: string }[] }> {
  const { token } = await signUpAndLogin(app, email);
  const cats = await request(app).get("/api/categories").set("Authorization", `Bearer ${token}`);
  return { token, categories: cats.body.categories };
}

async function addTransaction(token: string, body: Record<string, unknown>): Promise<void> {
  const res = await request(app).post("/api/transactions").set("Authorization", `Bearer ${token}`).send(body);
  expect(res.status).toBe(201);
}

function csvLines(text: string): string[] {
  return text.replace(/^﻿/, "").trimEnd().split("\r\n");
}

describe("toCsv", () => {
  it("quotes delimiters, quotes and line breaks, and neutralises formula-looking text", () => {
    const csv = toCsv(["A", "B"], [
      ['Dinner, drinks', 'He said "hi"'],
      ["line1\nline2", "=HYPERLINK(\"http://evil\")"],
      ["-5 refund", 12.5],
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csvLines(csv)).toEqual([
      "A,B",
      '"Dinner, drinks","He said ""hi"""',
      '"line1\nline2","\'=HYPERLINK(""http://evil"")"',
      "'-5 refund,12.5",
    ]);
  });
});

describe("GET /api/transactions/export", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/transactions/export");
    expect(res.status).toBe(401);
  });

  it("returns a CSV attachment of the user's transactions, oldest first", async () => {
    const { token, categories } = await signUp("export@example.com");
    const groceries = categories.find((c) => c.name === "Groceries")!;
    const salary = categories.find((c) => c.type === "income")!;
    await addTransaction(token, { category: groceries.id, type: "expense", amountCents: 4250, description: "Weekly shop, big", date: "2026-07-02" });
    await addTransaction(token, { category: salary.id, type: "income", amountCents: 300000, description: "July pay", date: "2026-07-01" });

    const res = await request(app).get("/api/transactions/export").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^text\/csv/);
    expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="transactions-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(csvLines(res.text)).toEqual([
      "Date,Type,Category,Description,Amount,Source",
      `2026-07-01,income,${salary.name},July pay,3000.00,manual`,
      '2026-07-02,expense,Groceries,"Weekly shop, big",42.50,manual',
    ]);
  });

  it("applies the same filters as the list", async () => {
    const { token, categories } = await signUp("filters@example.com");
    const groceries = categories.find((c) => c.name === "Groceries")!;
    const salary = categories.find((c) => c.type === "income")!;
    await addTransaction(token, { category: groceries.id, type: "expense", amountCents: 1000, date: "2026-06-15" });
    await addTransaction(token, { category: groceries.id, type: "expense", amountCents: 2000, date: "2026-07-15" });
    await addTransaction(token, { category: salary.id, type: "income", amountCents: 300000, date: "2026-07-01" });

    const res = await request(app)
      .get("/api/transactions/export")
      .query({ type: "expense", from: "2026-07-01", to: "2026-07-31" })
      .set("Authorization", `Bearer ${token}`);

    const lines = csvLines(res.text);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("2026-07-15,expense,Groceries,,20.00,manual");
  });

  it("never includes another user's transactions", async () => {
    const alice = await signUp("alice@example.com");
    const bob = await signUp("bob@example.com");
    const aliceGroceries = alice.categories.find((c) => c.name === "Groceries")!;
    await addTransaction(alice.token, { category: aliceGroceries.id, type: "expense", amountCents: 9900, date: "2026-07-01" });

    const res = await request(app).get("/api/transactions/export").set("Authorization", `Bearer ${bob.token}`);
    expect(csvLines(res.text)).toEqual(["Date,Type,Category,Description,Amount,Source"]);
  });
});
