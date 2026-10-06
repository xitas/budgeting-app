import { parseAmountInput } from "shared";
import { z } from "zod";

// Form field for a money amount: takes what the person typed ("12.50") and
// validates it into integer cents (1250) — the unit the API expects.
export function amountField(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .transform((text, ctx) => {
      const cents = parseAmountInput(text);
      if (cents === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be an amount like 12.50` });
        return z.NEVER;
      }
      if (cents <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be greater than 0` });
        return z.NEVER;
      }
      return cents;
    });
}

// For inline edits that keep the typed text in state: cents, or an error.
export function parseAmountDraft(label: string, text: string): { cents: number } | { error: string } {
  const result = amountField(label).safeParse(text);
  return result.success ? { cents: result.data } : { error: result.error.issues[0].message };
}
