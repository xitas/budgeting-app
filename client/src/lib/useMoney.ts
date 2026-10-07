import { useMemo } from "react";
import { DEFAULT_CURRENCY, formatMoney, formatSignedAmount, type Cents, type CurrencyCode, type FormatMoneyOptions } from "shared";
import { useAuth } from "../context/AuthContext";

export interface Money {
  currency: CurrencyCode;
  // "Rs 1,250.50" — the signed-in user's currency, thousands grouped.
  format: (cents: Cents, options?: Omit<FormatMoneyOptions, "currency">) => string;
  // "+Rs 3,200.00" / "-Rs 26.29" for income/expense rows.
  signed: (cents: Cents, type: "income" | "expense") => string;
}

// Every amount on screen goes through this, so it always shows the user's
// display currency (Settings → Currency).
export function useMoney(): Money {
  const { user } = useAuth();
  const currency = user?.currency ?? DEFAULT_CURRENCY;
  return useMemo(
    () => ({
      currency,
      format: (cents, options = {}) => formatMoney(cents, { grouping: true, ...options, currency }),
      signed: (cents, type) => formatSignedAmount(cents, type, { grouping: true, currency }),
    }),
    [currency]
  );
}
