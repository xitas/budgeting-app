import { HydratedDocument, Model, Schema, Types, model } from "mongoose";
import type { TransactionType } from "shared";

export interface ICategory {
  user: Types.ObjectId;
  name: string;
  type: TransactionType;
  color: string;
  icon?: string;
  isDefault: boolean;
}

export type CategoryDocument = HydratedDocument<ICategory>;

type CategoryModel = Model<ICategory>;

const categorySchema = new Schema<ICategory, CategoryModel>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["income", "expense"], required: true },
    color: { type: String, required: true },
    icon: { type: String },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Categories are scoped per-user, so uniqueness is per-user too — two
// different users (or one user's income/expense sides) can both have
// "Other" without colliding.
categorySchema.index({ user: 1, name: 1, type: 1 }, { unique: true });

categorySchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    const { __v, _id, ...rest } = ret;
    return rest;
  },
});

export const Category = model<ICategory, CategoryModel>("Category", categorySchema);
