import { HydratedDocument, Model, Schema, Types, model } from "mongoose";
import type { RecurringFrequency, TransactionType } from "shared";

export interface IRecurringTransaction {
  user: Types.ObjectId;
  category: Types.ObjectId;
  amount: number;
  type: TransactionType;
  description: string;
  frequency: RecurringFrequency;
  interval: number; // e.g. interval=2, frequency="weekly" -> every 2 weeks
  startDate: Date;
  endDate?: Date;
  lastGeneratedDate?: Date; // generation cursor — null until the first run
  isActive: boolean;
}

export type RecurringTransactionDocument = HydratedDocument<IRecurringTransaction>;

type RecurringTransactionModel = Model<IRecurringTransaction>;

// A small, stable template document — deliberately unlike Transaction, which
// is an unbounded, independently-growing collection. This is the contrasting
// case: one template generates many Transaction rows over time via
// recurring.service.ts, tracked through the lastGeneratedDate cursor below.
const recurringTransactionSchema = new Schema<IRecurringTransaction, RecurringTransactionModel>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ["income", "expense"], required: true },
    description: { type: String, trim: true, default: "" },
    frequency: { type: String, enum: ["daily", "weekly", "monthly"], required: true },
    interval: { type: Number, required: true, min: 1, default: 1 },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    lastGeneratedDate: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

recurringTransactionSchema.index({ user: 1, isActive: 1 });

recurringTransactionSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    const { __v, _id, ...rest } = ret;
    return rest;
  },
});

export const RecurringTransaction = model<IRecurringTransaction, RecurringTransactionModel>(
  "RecurringTransaction",
  recurringTransactionSchema
);
