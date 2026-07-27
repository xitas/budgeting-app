import { z } from "zod";

export const listBudgetsSchema = z.object({
  query: z.object({
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
  }),
});

export const createBudgetSchema = z.object({
  body: z.object({
    category: z.string().min(1, "Category is required"),
    limit: z.coerce.number().positive("Limit must be greater than 0"),
    month: z.coerce.number().int().min(1).max(12),
    year: z.coerce.number().int().min(2000).max(2100),
  }),
});

export const updateBudgetSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    limit: z.coerce.number().positive("Limit must be greater than 0"),
  }),
});

export const budgetIdParamsSchema = z.object({
  params: z.object({ id: z.string() }),
});

export type ListBudgetsQuery = z.infer<typeof listBudgetsSchema>["query"];
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>["body"];
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>["body"];
