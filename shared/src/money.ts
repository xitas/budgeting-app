// Money is stored, sent over the API and summed as an integer count of minor
// units ("cents"): 1250.50 is 125050. Every money field is named with a
// `Cents` suffix (amountCents, limitCents, ...) so the unit is never in doubt.
// Floats only appear at the edges — parsing what a person typed or what a CSV
// file contains, and formatting for display — and only through the helpers
// below, so web and mobile show and accept amounts identically.
//
// The app has no currency setting; amounts are in a currency with 2 decimal
// places.

export type Cents = number;

export const CENTS_PER_UNIT = 100;

export function isCents(value: unknown): value is Cents {
  return typeof value === "number" && Number.isSafeInteger(value);
}

// Converts a decimal number (from a parsed CSV cell, or a legacy stored
// amount) to cents, rounding half up at the 2nd decimal *as written*:
// 1.005 -> 101 and 0.1 + 0.2 -> 30, even though both are inexact in binary.
// toPrecision(15) discards the binary noise before rounding.
export function centsFromDecimal(value: number): Cents {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Not a finite amount: ${value}`);
  }
  const scaled = Number((value * CENTS_PER_UNIT).toPrecision(15));
  // Math.round rounds .5 toward +Infinity; mirror it for negatives so the
  // rule is "half away from zero" in both directions.
  return Math.sign(scaled) * Math.round(Math.abs(scaled)) + 0; // + 0 turns -0 into 0
}

const AMOUNT_INPUT = /^([+-])?(\d+)?(?:[.,](\d*))?$/;

// Parses an amount a person typed ("12", "12.5", "12,50", " 1250.50 ") into
// cents without going through floating point. Thousands separators are not
// accepted here (forms use plain numeric inputs); CSV import has its own
// locale-aware number parsing and converts with centsFromDecimal.
// Returns null for anything that isn't a plain amount with at most 2 decimals.
export function parseAmountInput(input: string): Cents | null {
  const match = AMOUNT_INPUT.exec(input.trim());
  if (!match) return null;
  const [, sign, whole = "", fraction = ""] = match;
  if (whole === "" && fraction === "") return null;
  if (fraction.length > 2) return null;
  const cents = Number(whole || "0") * CENTS_PER_UNIT + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return null;
  return sign === "-" ? -cents : cents;
}

// Plain decimal text, e.g. 125050 -> "1250.50", -5 -> "-0.05". Used for CSV
// export and for pre-filling edit inputs.
export function centsToDecimalString(cents: Cents): string {
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / CENTS_PER_UNIT);
  const fraction = String(abs % CENTS_PER_UNIT).padStart(2, "0");
  return `${cents < 0 ? "-" : ""}${whole}.${fraction}`;
}

export interface FormatMoneyOptions {
  // "auto" (default): "-" for negatives only. "always": "+" or "-" (use for
  // income/expense rows). "never": magnitude only.
  sign?: "auto" | "always" | "never";
  // Separate thousands ("1,250.50"). Off by default to match the app's
  // existing compact look.
  grouping?: boolean;
}

// The one display formatter for money in both apps.
export function formatMoney(cents: Cents, options: FormatMoneyOptions = {}): string {
  const { sign = "auto", grouping = false } = options;
  const [whole, fraction] = centsToDecimalString(Math.abs(cents)).split(".");
  const wholeText = grouping ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : whole;
  const prefix = sign === "never" ? "" : cents < 0 ? "-" : sign === "always" ? "+" : "";
  return `${prefix}${wholeText}.${fraction}`;
}

// Shorthand for the "+12.30" / "-12.30" convention on income/expense rows,
// where the stored amount is always positive and the type gives the sign.
export function formatSignedAmount(cents: Cents, type: "income" | "expense"): string {
  return `${type === "income" ? "+" : "-"}${formatMoney(cents, { sign: "never" })}`;
}

// Cents as a plain number in currency units, for chart scales only — never
// for arithmetic or storage.
export function centsToUnits(cents: Cents): number {
  return cents / CENTS_PER_UNIT;
}

export function sumCents(values: Iterable<Cents>): Cents {
  let total = 0;
  for (const value of values) total += value;
  return total;
}
