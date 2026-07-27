import { z } from "zod";

export const dashboardQuerySchema = z.object({
  query: z.object({
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
  }),
});

export const trendQuerySchema = z.object({
  query: z.object({
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    months: z.coerce.number().int().min(1).max(24).optional(),
  }),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>["query"];
export type TrendQuery = z.infer<typeof trendQuerySchema>["query"];
