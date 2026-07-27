import { z } from "zod";

export const createLoanSchema = z.object({
  body: z.object({
    counterparty: z.string().min(1, "Counterparty is required"),
    direction: z.enum(["lent", "borrowed"]),
    principal: z.coerce.number().positive("Principal must be greater than 0"),
    description: z.string().optional().default(""),
    date: z.coerce.date(),
  }),
});

// direction is immutable after creation — changing it would flip the
// cash-flow semantics of the already-created linked transaction.
export const updateLoanSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    counterparty: z.string().min(1).optional(),
    principal: z.coerce.number().positive().optional(),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
    writtenOff: z.boolean().optional(),
  }),
});

export const loanIdParamsSchema = z.object({
  params: z.object({ id: z.string() }),
});

export const addRepaymentSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    date: z.coerce.date(),
    note: z.string().optional(),
  }),
});

export const repaymentIdParamsSchema = z.object({
  params: z.object({ id: z.string(), repaymentId: z.string() }),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>["body"];
export type UpdateLoanInput = z.infer<typeof updateLoanSchema>["body"];
export type AddRepaymentInput = z.infer<typeof addRepaymentSchema>["body"];
