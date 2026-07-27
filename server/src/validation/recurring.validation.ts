import { z } from "zod";

export const createRecurringSchema = z.object({
  body: z.object({
    category: z.string().min(1, "Category is required"),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    type: z.enum(["income", "expense"]),
    description: z.string().optional().default(""),
    frequency: z.enum(["daily", "weekly", "monthly"]),
    interval: z.coerce.number().int().positive().default(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
  }),
});

// Identity fields (category, type, frequency, interval, startDate) are
// immutable after creation — changing them mid-stream would make the
// lastGeneratedDate cursor's meaning ambiguous. Delete and recreate instead.
export const updateRecurringSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    amount: z.coerce.number().positive().optional(),
    description: z.string().optional(),
    endDate: z.coerce.date().nullable().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const recurringIdParamsSchema = z.object({
  params: z.object({ id: z.string() }),
});

export type CreateRecurringInput = z.infer<typeof createRecurringSchema>["body"];
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>["body"];
