import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Transaction } from "../models/Transaction";
import { User } from "../models/User";
import * as loanService from "../services/loan.service";
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

async function createUser(email: string) {
  const user = new User({ email, name: "Loan Test" });
  (user as unknown as { password: string }).password = "password123";
  await user.save();
  return user;
}

describe("loan.service", () => {
  it("creating a lent loan links an expense transaction against Loan Out", async () => {
    const user = await createUser("lent@example.com");
    const loan = await loanService.createLoan(user.id, {
      counterparty: "Alex",
      direction: "lent",
      principal: 500,
      description: "",
      date: new Date("2026-06-01"),
    });

    expect(loan.outstanding).toBe(500);
    expect(loan.repaid).toBe(0);
    expect(loan.status).toBe("open");

    const transaction = await Transaction.findById(loan.transactionId).populate<{
      category: { name: string; type: string };
    }>("category", "name type");
    expect(transaction).not.toBeNull();
    expect(transaction!.type).toBe("expense");
    expect(transaction!.amount).toBe(500);
    expect(transaction!.source).toBe("loan");
    expect((transaction!.category as unknown as { name: string }).name).toBe("Loan Out");
  });

  it("creating a borrowed loan links an income transaction against Loan In", async () => {
    const user = await createUser("borrowed@example.com");
    const loan = await loanService.createLoan(user.id, {
      counterparty: "Sam",
      direction: "borrowed",
      principal: 200,
      description: "",
      date: new Date("2026-06-01"),
    });

    const transaction = await Transaction.findById(loan.transactionId).populate<{
      category: { name: string };
    }>("category", "name");
    expect(transaction!.type).toBe("income");
    expect((transaction!.category as unknown as { name: string }).name).toBe("Loan In");
  });

  it("repayments reduce outstanding and create the opposite cash-flow transaction", async () => {
    const user = await createUser("repay@example.com");
    const loan = await loanService.createLoan(user.id, {
      counterparty: "Alex",
      direction: "lent",
      principal: 500,
      description: "",
      date: new Date("2026-06-01"),
    });

    const afterFirst = await loanService.addRepayment(user.id, loan.id, {
      amount: 200,
      date: new Date("2026-06-15"),
    });
    expect(afterFirst.repaid).toBe(200);
    expect(afterFirst.outstanding).toBe(300);

    const repaymentTx = await Transaction.findById(afterFirst.repayments[0].transactionId);
    expect(repaymentTx!.type).toBe("income"); // lent + repayment = income to you
    expect(repaymentTx!.amount).toBe(200);

    const afterSecond = await loanService.addRepayment(user.id, loan.id, {
      amount: 100,
      date: new Date("2026-07-01"),
    });
    expect(afterSecond.repaid).toBe(300);
    expect(afterSecond.outstanding).toBe(200);
  });

  it("overpayment goes negative without erroring", async () => {
    const user = await createUser("overpay@example.com");
    const loan = await loanService.createLoan(user.id, {
      counterparty: "Alex",
      direction: "lent",
      principal: 100,
      description: "",
      date: new Date("2026-06-01"),
    });

    const after = await loanService.addRepayment(user.id, loan.id, { amount: 150, date: new Date("2026-06-15") });
    expect(after.outstanding).toBe(-50);
  });

  it("writing off a loan zeroes outstanding without touching repaid or creating a transaction", async () => {
    const user = await createUser("writeoff@example.com");
    const loan = await loanService.createLoan(user.id, {
      counterparty: "Alex",
      direction: "lent",
      principal: 500,
      description: "",
      date: new Date("2026-06-01"),
    });
    await loanService.addRepayment(user.id, loan.id, { amount: 100, date: new Date("2026-06-15") });

    const countBefore = await Transaction.countDocuments({ user: user.id });
    const written = await loanService.updateLoan(user.id, loan.id, { writtenOff: true });
    const countAfter = await Transaction.countDocuments({ user: user.id });

    expect(written.status).toBe("written_off");
    expect(written.outstanding).toBe(0);
    expect(written.repaid).toBe(100); // unchanged
    expect(countAfter).toBe(countBefore); // no new transaction
  });

  it("deleting a loan removes all its linked transactions atomically", async () => {
    const user = await createUser("delete@example.com");
    const loan = await loanService.createLoan(user.id, {
      counterparty: "Alex",
      direction: "lent",
      principal: 500,
      description: "",
      date: new Date("2026-06-01"),
    });
    await loanService.addRepayment(user.id, loan.id, { amount: 100, date: new Date("2026-06-15") });
    await loanService.addRepayment(user.id, loan.id, { amount: 100, date: new Date("2026-07-01") });

    expect(await Transaction.countDocuments({ loanSourceId: loan._id })).toBe(3);

    await loanService.deleteLoan(user.id, loan.id);

    expect(await Transaction.countDocuments({ loanSourceId: loan._id })).toBe(0);
  });

  it("removing one repayment removes only its own transaction and recalculates outstanding", async () => {
    const user = await createUser("removerepay@example.com");
    const loan = await loanService.createLoan(user.id, {
      counterparty: "Alex",
      direction: "lent",
      principal: 500,
      description: "",
      date: new Date("2026-06-01"),
    });
    const afterFirst = await loanService.addRepayment(user.id, loan.id, { amount: 100, date: new Date("2026-06-15") });
    const afterSecond = await loanService.addRepayment(user.id, loan.id, { amount: 150, date: new Date("2026-07-01") });
    expect(afterSecond.outstanding).toBe(250);

    const firstRepaymentId = afterFirst.repayments[0].id as string;
    const firstRepaymentTxId = afterFirst.repayments[0].transactionId;

    const afterRemoval = await loanService.removeRepayment(user.id, loan.id, firstRepaymentId);
    expect(afterRemoval.repaid).toBe(150);
    expect(afterRemoval.outstanding).toBe(350);
    expect(afterRemoval.repayments).toHaveLength(1);

    expect(await Transaction.findById(firstRepaymentTxId)).toBeNull();
    // the initial loan transaction and the remaining repayment's transaction are untouched
    expect(await Transaction.countDocuments({ loanSourceId: loan._id })).toBe(2);
  });
});
