import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { User } from "../models/User";
import * as loanService from "../services/loan.service";
import { deleteTransaction, updateTransaction } from "../services/transaction.service";
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

describe("transaction.service — loan-sourced guard", () => {
  it("rejects editing and deleting a transaction created by a loan", async () => {
    const user = new User({ email: "guard@example.com", name: "Guard Test" });
    (user as unknown as { password: string }).password = "password123";
    await user.save();

    const loan = await loanService.createLoan(user.id, {
      counterparty: "Alex",
      direction: "lent",
      principal: 500,
      description: "",
      date: new Date("2026-06-01"),
    });

    await expect(updateTransaction(user.id, loan.transactionId.toString(), { amount: 999 })).rejects.toMatchObject({
      statusCode: 409,
    });
    await expect(deleteTransaction(user.id, loan.transactionId.toString())).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});
