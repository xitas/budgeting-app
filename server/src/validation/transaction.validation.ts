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

// Same filters as the list, minus paging: an export is the whole result.
export const exportTransactionsSchema = z.object({
  query: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    category: z.string().optional(),
    type: z.enum(["income", "expense"]).optional(),
  }),
});

// CSV import. The client parses and maps the file; the server receives
// clean rows. Capped so one request stays well inside the body limit.
export const MAX_IMPORT_ROWS = 5000;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const importAmount = z.number().positive("Amount must be greater than 0");

// Duplicate check: no category yet (the user may still be choosing them).
export const importCheckSchema = z.object({
  body: z.object({
    rows: z
      .array(
        z.object({
          date: isoDate,
          type: z.enum(["income", "expense"]),
          amount: importAmount,
          description: z.string().max(500).optional().default(""),
        })
      )
      .min(1, "No rows to check")
      .max(MAX_IMPORT_ROWS, `At most ${MAX_IMPORT_ROWS} rows per import`),
  }),
});

export const importTransactionsSchema = z.object({
  body: z.object({
    rows: z
      .array(
        z.object({
          date: isoDate,
          type: z.enum(["income", "expense"]),
          amount: importAmount,
          description: z.string().max(500).optional().default(""),
          category: z.string().min(1, "Category is required"),
        })
      )
      .min(1, "No rows to import")
      .max(MAX_IMPORT_ROWS, `At most ${MAX_IMPORT_ROWS} rows per import`),
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
export type ExportTransactionsQuery = z.infer<typeof exportTransactionsSchema>["query"];
export type ImportCheckRow = z.infer<typeof importCheckSchema>["body"]["rows"][number];
export type ImportTransactionRow = z.infer<typeof importTransactionsSchema>["body"]["rows"][number];
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>["body"];
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>["body"];
