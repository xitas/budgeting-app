import { HydratedDocument, Model, Schema, Types, model } from "mongoose";
import type { LoanDirection, LoanStatus } from "shared";

export interface IRepayment {
  amount: number;
  date: Date;
  note?: string;
  transactionId: Types.ObjectId; // the Transaction this repayment created
}

export interface ILoan {
  user: Types.ObjectId;
  counterparty: string; // free text — the other person isn't necessarily an app user
  direction: LoanDirection; // immutable after creation
  principal: number;
  description: string;
  date: Date;
  transactionId: Types.ObjectId; // the linked initial Transaction
  writtenOff: boolean;
  repayments: Types.DocumentArray<IRepayment>; // embedded subdocuments
}

interface ILoanVirtuals {
  repaid: number;
  outstanding: number;
  status: LoanStatus;
}

export type LoanDocument = HydratedDocument<ILoan, ILoanVirtuals>;

type LoanModel = Model<ILoan, {}, {}, ILoanVirtuals>;

const repaymentSchema = new Schema<IRepayment>(
  {
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
    note: { type: String, trim: true },
    transactionId: { type: Schema.Types.ObjectId, ref: "Transaction", required: true },
  },
  { timestamps: false }
);

repaymentSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    const { __v, _id, ...rest } = ret;
    return rest;
  },
});

// A loan's repayments are bounded (a handful over the life of one loan),
// always read together with the loan, and never queried independently
// across users — the textbook embed case, in deliberate contrast to
// Transaction's reference-based design (see Transaction.ts).
const loanSchema = new Schema<ILoan, LoanModel>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    counterparty: { type: String, required: true, trim: true },
    direction: { type: String, enum: ["lent", "borrowed"], required: true },
    principal: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true, default: "" },
    date: { type: Date, required: true },
    transactionId: { type: Schema.Types.ObjectId, ref: "Transaction", required: true },
    writtenOff: { type: Boolean, default: false },
    repayments: { type: [repaymentSchema], default: [] },
  },
  { timestamps: true }
);

loanSchema.index({ user: 1, date: -1 });

// Computed synchronously by reducing over the already-loaded repayments
// array — no aggregation needed, since embedding means the data is already
// in memory once the parent loads (contrast with Budget.spent, which needs
// an aggregation because its spend data lives in a separate collection).
loanSchema.virtual("repaid").get(function (this: LoanDocument) {
  return this.repayments.reduce((sum, r) => sum + r.amount, 0);
});

loanSchema.virtual("outstanding").get(function (this: LoanDocument) {
  if (this.writtenOff) {
    return 0;
  }
  return this.principal - this.repaid;
});

loanSchema.virtual("status").get(function (this: LoanDocument): LoanStatus {
  if (this.writtenOff) {
    return "written_off";
  }
  if (this.outstanding <= 0) {
    return "settled";
  }
  return "open";
});

loanSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    const { __v, _id, ...rest } = ret;
    return rest;
  },
});

export const Loan = model<ILoan, LoanModel>("Loan", loanSchema);
