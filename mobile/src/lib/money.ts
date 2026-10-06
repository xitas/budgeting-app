import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { parseAmountInput } from "shared";
import { z } from "zod";

// Form field for a money amount: takes what the person typed ("12.50" or
// "12,50") and validates it into integer cents (1250) — the unit the API
// expects. Edit forms seed it with centsToDecimalString(...).
export function amountField(label: string) {
  return z
    .string({ required_error: "Enter an amount" })
    .trim()
    .min(1, "Enter an amount")
    .transform((text, ctx) => {
      const cents = parseAmountInput(text);
      if (cents === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter an amount like 12.50" });
        return z.NEVER;
      }
      if (cents <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be greater than 0` });
        return z.NEVER;
      }
      return cents;
    });
}

// zodResolver for schemas whose output differs from their input (typed
// "12.50" -> 1250 cents). @hookform/resolvers v3 already returns the parsed
// values at runtime; only its types predate separate input/output form types.
export function zodFormResolver<S extends z.ZodTypeAny>(schema: S): Resolver<z.input<S>, unknown, z.output<S>> {
  return zodResolver(schema) as unknown as Resolver<z.input<S>, unknown, z.output<S>>;
}
