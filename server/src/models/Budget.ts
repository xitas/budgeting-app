import { HydratedDocument, Model, Schema, Types, model } from "mongoose";

export interface IBudget {
  user: Types.ObjectId;
  category: Types.ObjectId;
  limit: number;
  month: number; // 1-12
  year: number;
}

export type BudgetDocument = HydratedDocument<IBudget>;

type BudgetModel = Model<IBudget>;

const budgetSchema = new Schema<IBudget, BudgetModel>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    limit: { type: Number, required: true, min: 0 },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000, max: 2100 },
  },
  { timestamps: true }
);

// One budget per category per month. Deliberately no stored "spent" field —
// budget-vs-actual is computed live via aggregation over Transaction at read
// time (see budget.service.ts), so it can never drift out of sync.
budgetSchema.index({ user: 1, category: 1, month: 1, year: 1 }, { unique: true });

budgetSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    const { __v, _id, ...rest } = ret;
    return rest;
  },
});

export const Budget = model<IBudget, BudgetModel>("Budget", budgetSchema);
