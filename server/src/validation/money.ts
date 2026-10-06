import { z } from "zod";

// API money fields are integer cents (see shared/src/money.ts): 1250.50 is
// sent as 125050. Plain JSON numbers only — no string coercion — so a client
// still sending decimal amounts gets a clear 400 instead of a value 100x off.
export function positiveCents(label: string) {
  return z
    .number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a number of cents` })
    .int(`${label} must be a whole number of cents`)
    .positive(`${label} must be greater than 0`)
    .max(Number.MAX_SAFE_INTEGER, `${label} is too large`);
}
