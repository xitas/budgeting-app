// Money is stored, sent over the API and summed as an integer count of the
// currency's minor unit ("cents"): 1250.50 is 125050. Every money field is
// named with a `Cents` suffix (amountCents, limitCents, ...) so the unit is
// never in doubt. Floats only appear at the edges — parsing what a person
// typed or what a CSV file contains, and formatting for display — and only
// through the helpers below, so web and mobile show and accept amounts
// identically.
//
// Each user picks a display currency (see currency.ts). Helpers take the
// number of decimals where it matters; it defaults to 2, which every
// supported currency uses.

import { getCurrency, type CurrencyCode } from "./currency";

export type Cents = number;

const DEFAULT_DECIMALS = 2;
export const CENTS_PER_UNIT = 100;

function unitsPerMajor(decimals: number): number {
  return 10 ** decimals;
}

export function isCents(value: unknown): value is Cents {
  return typeof value === "number" && Number.isSafeInteger(value);
}

// Converts a decimal number (from a parsed CSV cell, or a legacy stored
// amount) to minor units, rounding half away from zero at the last decimal
// *as written*: 1.005 -> 101 and 0.1 + 0.2 -> 30, even though both are
// inexact in binary. toPrecision(15) discards the binary noise first.
export function centsFromDecimal(value: number, decimals = DEFAULT_DECIMALS): Cents {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Not a finite amount: ${value}`);
  }
  const scaled = Number((value * unitsPerMajor(decimals)).toPrecision(15));
  return Math.sign(scaled) * Math.round(Math.abs(scaled)) + 0; // + 0 turns -0 into 0
}

const AMOUNT_INPUT = /^([+-])?(\d+)?(?:[.,](\d*))?$/;

// Parses an amount a person typed ("12", "12.5", "12,50", " 1250.50 ") into
// minor units without going through floating point. Thousands separators are
// not accepted here (forms use plain numeric inputs); CSV import has its own
// locale-aware number parsing and converts with centsFromDecimal.
// Returns null for anything that isn't a plain amount with at most
// `decimals` decimal places.
export function parseAmountInput(input: string, decimals = DEFAULT_DECIMALS): Cents | null {
  const match = AMOUNT_INPUT.exec(input.trim());
  if (!match) return null;
  const [, sign, whole = "", fraction = ""] = match;
  if (whole === "" && fraction === "") return null;
  if (fraction.length > decimals) return null;
  const cents = Number(whole || "0") * unitsPerMajor(decimals) + Number(fraction.padEnd(decimals, "0") || "0");
  if (!Number.isSafeInteger(cents)) return null;
  return sign === "-" ? -cents : cents;
}

// Plain decimal text, e.g. 125050 -> "1250.50", -5 -> "-0.05". Used for CSV
// export, backups and pre-filling edit inputs — never carries a symbol.
export function centsToDecimalString(cents: Cents, decimals = DEFAULT_DECIMALS): string {
  const abs = Math.abs(cents);
  const per = unitsPerMajor(decimals);
  const whole = Math.floor(abs / per);
  const sign = cents < 0 ? "-" : "";
  if (decimals === 0) return `${sign}${whole}`;
  return `${sign}${whole}.${String(abs % per).padStart(decimals, "0")}`;
}

export interface FormatMoneyOptions {
  // "auto" (default): "-" for negatives only. "always": "+" or "-" (use for
  // income/expense rows). "never": magnitude only.
  sign?: "auto" | "always" | "never";
  // Separate thousands ("1,250.50").
  grouping?: boolean;
  // Adds the currency symbol and uses its decimals ("Rs 1,250.50", "$12.30").
  // Without it: a bare 2-decimal number, as in charts' tables and tests.
  currency?: CurrencyCode | string;
}

// The one display formatter for money in both apps (the apps wrap it with the
// signed-in user's currency — see useMoney in each app).
export function formatMoney(cents: Cents, options: FormatMoneyOptions = {}): string {
  const { sign = "auto", grouping = false } = options;
  const currency = options.currency ? getCurrency(options.currency) : null;
  const decimals = currency?.decimals ?? DEFAULT_DECIMALS;
  const [whole, fraction] = centsToDecimalString(Math.abs(cents), decimals).split(".");
  const wholeText = grouping ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : whole;
  const number = fraction === undefined ? wholeText : `${wholeText}.${fraction}`;
  const prefix = sign === "never" ? "" : cents < 0 ? "-" : sign === "always" ? "+" : "";
  if (!currency) return `${prefix}${number}`;
  return `${prefix}${currency.symbol}${currency.spaced ? " " : ""}${number}`;
}

// Shorthand for the "+12.30" / "-12.30" convention on income/expense rows,
// where the stored amount is always positive and the type gives the sign.
export function formatSignedAmount(
  cents: Cents,
  type: "income" | "expense",
  options: Omit<FormatMoneyOptions, "sign"> = {}
): string {
  return `${type === "income" ? "+" : "-"}${formatMoney(cents, { ...options, sign: "never" })}`;
}

// Minor units as a plain number in currency units, for chart scales only —
// never for arithmetic or storage.
export function centsToUnits(cents: Cents, decimals = DEFAULT_DECIMALS): number {
  return cents / unitsPerMajor(decimals);
}

export function sumCents(values: Iterable<Cents>): Cents {
  let total = 0;
  for (const value of values) total += value;
  return total;
}
