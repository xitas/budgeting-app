// The currencies a user can pick (per-user setting, default PKR). Amounts are
// stored in the currency's minor unit (see money.ts), so `decimals` says how
// many minor-unit digits a displayed amount has.
//
// Every currency here has 2 decimals, so switching between them never changes
// a stored value — only its label. A currency with a different number of
// decimals (e.g. JPY, 0) must not be added without converting stored amounts
// when a user switches to or from it.

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  // Symbols that are letters read better with a space: "Rs 1,250.00", "$1,250.00".
  spaced: boolean;
}

export const CURRENCIES = [
  { code: "PKR", name: "Pakistani rupee", symbol: "Rs", decimals: 2, spaced: true },
  { code: "USD", name: "US dollar", symbol: "$", decimals: 2, spaced: false },
  { code: "EUR", name: "Euro", symbol: "€", decimals: 2, spaced: false },
  { code: "GBP", name: "British pound", symbol: "£", decimals: 2, spaced: false },
  { code: "AED", name: "UAE dirham", symbol: "AED", decimals: 2, spaced: true },
  { code: "SAR", name: "Saudi riyal", symbol: "SAR", decimals: 2, spaced: true },
  { code: "INR", name: "Indian rupee", symbol: "₹", decimals: 2, spaced: false },
] as const satisfies readonly Currency[];

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export const DEFAULT_CURRENCY: CurrencyCode = "PKR";

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as unknown as readonly [CurrencyCode, ...CurrencyCode[]];

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && CURRENCIES.some((c) => c.code === value);
}

export function getCurrency(code: string | undefined): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES.find((c) => c.code === DEFAULT_CURRENCY)!;
}
