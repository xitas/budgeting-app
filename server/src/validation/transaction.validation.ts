import { z } from "zod";

export const listTransactionsSchema = z.object({
  query: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    category: z.string().optional(),
    type: z.enum(["income", "expense"]).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const createTransactionSchema = z.object({
  body: z.object({
    category: z.string().min(1, "Category is required"),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    type: z.enum(["income", "expense"]),
    description: z.string().optional().default(""),
    date: z.coerce.date(),
  }),
});

export const updateTransactionSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    category: z.string().min(1).optional(),
    amount: z.coerce.number().positive().optional(),
    type: z.enum(["income", "expense"]).optional(),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
  }),
});

export const transactionIdParamsSchema = z.object({
  params: z.object({ id: z.string() }),
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsSchema>["query"];
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>["body"];
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>["body"];
