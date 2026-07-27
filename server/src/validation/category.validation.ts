import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #2a78d6");

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required"),
    type: z.enum(["income", "expense"]),
    color: hexColor,
    icon: z.string().optional(),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    name: z.string().min(1).optional(),
    color: hexColor.optional(),
    icon: z.string().optional(),
  }),
});

export const categoryIdParamsSchema = z.object({
  params: z.object({ id: z.string() }),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>["body"];
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>["body"];
