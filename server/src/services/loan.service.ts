import mongoose, { ClientSession } from "mongoose";
import { CATEGORICAL_PALETTE, type LoanDirection, type TransactionType } from "shared";
import { Category, CategoryDocument } from "../models/Category";
import { Loan, LoanDocument } from "../models/Loan";
import { Transaction } from "../models/Transaction";
import { AppError } from "../utils/AppError";
import { AddRepaymentInput, CreateLoanInput, UpdateLoanInput } from "../validation/loan.validation";

const LOAN_OUT_COLOR = CATEGORICAL_PALETTE[7]; // red — cash leaving you
const LOAN_IN_COLOR = CATEGORICAL_PALETTE[2]; // aqua — cash entering you

async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}

// "Loan Out"/"Loan In" represent cash-flow direction, not loan direction:
// lending out and repaying a borrowed loan are both Loan Out; borrowing and
// being repaid are both Loan In. Created lazily on first use rather than at
// signup, so existing accounts don't need a migration.
async function getOrCreateLoanCategory(
  userId: string,
  type: TransactionType,
  session: ClientSession
): Promise<CategoryDocument> {
  const name = type === "expense" ? "Loan Out" : "Loan In";
  const color = type === "expense" ? LOAN_OUT_COLOR : LOAN_IN_COLOR;

  const existing = await Category.findOne({ user: userId, name, type }).session(session);
  if (existing) {
    return existing;
  }

  const [created] = await Category.create([{ user: userId, name, type, color, isDefault: false }], { session });
  return created;
}

function cashFlowType(direction: LoanDirection, isRepayment: boolean): TransactionType {
  const isOutflow = isRepayment !== (direction === "lent");
  return isOutflow ? "expense" : "income";
}

function describeLoanTransaction(
  direction: LoanDirection,
  counterparty: string,
  isRepayment: boolean,
  note?: string
): string {
  const base = isRepayment
    ? direction === "lent"
      ? `Repayment from ${counterparty}`
      : `Repayment to ${counterparty}`
    : direction === "lent"
      ? `Loan to ${counterparty}`
      : `Loan from ${counterparty}`;
  return note ? `${base} — ${note}` : base;
}

export async function listLoans(userId: string): Promise<LoanDocument[]> {
  return Loan.find({ user: userId }).sort({ date: -1 });
}

export async function createLoan(userId: string, input: CreateLoanInput): Promise<LoanDocument> {
  return withTransaction(async (session) => {
    const type = cashFlowType(input.direction, false);
    const category = await getOrCreateLoanCategory(userId, type, session);

    // loan._id is generated on construction, before save — so it can be
    // referenced by the Transaction below without needing a placeholder.
    const loan = new Loan({
      user: userId,
      counterparty: input.counterparty,
      direction: input.direction,
      principal: input.principal,
      description: input.description,
      date: input.date,
      writtenOff: false,
      repayments: [],
    });

    const [transaction] = await Transaction.create(
      [
        {
          user: userId,
          category: category._id,
          amount: input.principal,
          type,
          description: describeLoanTransaction(input.direction, input.counterparty, false, input.description),
          date: input.date,
          source: "loan",
          loanSourceId: loan._id,
        },
      ],
      { session }
    );

    loan.transactionId = transaction._id;
    await loan.save({ session });
    return loan;
  });
}

export async function updateLoan(userId: string, loanId: string, updates: UpdateLoanInput): Promise<LoanDocument> {
  return withTransaction(async (session) => {
    const loan = await Loan.findOne({ _id: loanId, user: userId }).session(session);
    if (!loan) {
      throw new AppError(404, "Loan not found");
    }

    const transactionFieldsChanged =
      updates.principal !== undefined ||
      updates.description !== undefined ||
      updates.date !== undefined ||
      updates.counterparty !== undefined;

    if (updates.counterparty !== undefined) loan.counterparty = updates.counterparty;
    if (updates.principal !== undefined) loan.principal = updates.principal;
    if (updates.description !== undefined) loan.description = updates.description;
    if (updates.date !== undefined) loan.date = updates.date;
    if (updates.writtenOff !== undefined) loan.writtenOff = updates.writtenOff;

    if (transactionFieldsChanged) {
      const transaction = await Transaction.findById(loan.transactionId).session(session);
      if (transaction) {
        if (updates.principal !== undefined) transaction.amount = updates.principal;
        if (updates.date !== undefined) transaction.date = updates.date;
        transaction.description = describeLoanTransaction(loan.direction, loan.counterparty, false, loan.description);
        await transaction.save({ session });
      }
    }

    await loan.save({ session });
    return loan;
  });
}

export async function deleteLoan(userId: string, loanId: string): Promise<void> {
  await withTransaction(async (session) => {
    const loan = await Loan.findOne({ _id: loanId, user: userId }).session(session);
    if (!loan) {
      throw new AppError(404, "Loan not found");
    }
    // Cascades to every transaction this loan created (the initial one and
    // every repayment) — "delete" undoes everything it created.
    await Transaction.deleteMany({ loanSourceId: loan._id }, { session });
    await Loan.deleteOne({ _id: loan._id }, { session });
  });
}

export async function addRepayment(userId: string, loanId: string, input: AddRepaymentInput): Promise<LoanDocument> {
  return withTransaction(async (session) => {
    const loan = await Loan.findOne({ _id: loanId, user: userId }).session(session);
    if (!loan) {
      throw new AppError(404, "Loan not found");
    }

    const type = cashFlowType(loan.direction, true);
    const category = await getOrCreateLoanCategory(userId, type, session);

    const [transaction] = await Transaction.create(
      [
        {
          user: userId,
          category: category._id,
          amount: input.amount,
          type,
          description: describeLoanTransaction(loan.direction, loan.counterparty, true, input.note),
          date: input.date,
          source: "loan",
          loanSourceId: loan._id,
        },
      ],
      { session }
    );

    loan.repayments.push({ amount: input.amount, date: input.date, note: input.note, transactionId: transaction._id });
    await loan.save({ session });
    return loan;
  });
}

export async function removeRepayment(userId: string, loanId: string, repaymentId: string): Promise<LoanDocument> {
  return withTransaction(async (session) => {
    const loan = await Loan.findOne({ _id: loanId, user: userId }).session(session);
    if (!loan) {
      throw new AppError(404, "Loan not found");
    }
    const repayment = loan.repayments.id(repaymentId);
    if (!repayment) {
      throw new AppError(404, "Repayment not found");
    }

    await Transaction.deleteOne({ _id: repayment.transactionId }, { session });
    loan.repayments.pull({ _id: repaymentId });
    await loan.save({ session });
    return loan;
  });
}
