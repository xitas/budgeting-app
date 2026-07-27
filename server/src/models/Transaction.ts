import { HydratedDocument, Model, Schema, Types, model } from "mongoose";
import type { TransactionSource, TransactionType } from "shared";

export interface ITransaction {
  user: Types.ObjectId;
  category: Types.ObjectId;
  amount: number;
  type: TransactionType;
  description: string;
  date: Date;
  source: TransactionSource;
  recurringSourceId?: Types.ObjectId;
  loanSourceId?: Types.ObjectId;
}

export type TransactionDocument = HydratedDocument<ITransaction>;

type TransactionModel = Model<ITransaction>;

// Transactions reference User/Category by ObjectId rather than embedding:
// the collection is unbounded and grows independently of its parents, which
// is the textbook case for referencing over embedding in MongoDB.
const transactionSchema = new Schema<ITransaction, TransactionModel>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ["income", "expense"], required: true },
    description: { type: String, trim: true, default: "" },
    date: { type: Date, required: true },
    source: { type: String, enum: ["manual", "recurring", "loan"], default: "manual" },
    recurringSourceId: { type: Schema.Types.ObjectId, ref: "RecurringTransaction" },
    loanSourceId: { type: Schema.Types.ObjectId, ref: "Loan" },
  },
  { timestamps: true }
);

// Covers "list my transactions by date range" (the common case) and the
// per-category aggregations the dashboard will run in M6.
transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, category: 1, date: -1 });

transactionSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    const { __v, _id, ...rest } = ret;
    return rest;
  },
});

export const Transaction = model<ITransaction, TransactionModel>("Transaction", transactionSchema);
