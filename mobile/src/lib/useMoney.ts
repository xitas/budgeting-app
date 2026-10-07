import { useMemo } from "react";
import { DEFAULT_CURRENCY, formatMoney, formatSignedAmount, type Cents, type CurrencyCode, type FormatMoneyOptions } from "shared";
import { useAuth } from "../context/AuthContext";

export interface Money {
  currency: CurrencyCode;
  // "Rs 1,250.50" — the signed-in user's currency, thousands grouped.
  // `symbol: false` drops the symbol (tight spots like chart bar labels).
  format: (cents: Cents, options?: Omit<FormatMoneyOptions, "currency"> & { symbol?: boolean }) => string;
  // "+Rs 3,200.00" / "-Rs 26.29" for income/expense rows.
  signed: (cents: Cents, type: "income" | "expense") => string;
}

// Every amount on screen goes through this, so it always shows the user's
// display currency (More → Settings → Currency). Same rules as the web app.
export function useMoney(): Money {
  const { user } = useAuth();
  const currency = user?.currency ?? DEFAULT_CURRENCY;
  return useMemo(
    () => ({
      currency,
      format: (cents, { symbol = true, ...options } = {}) =>
        formatMoney(cents, { grouping: true, ...options, ...(symbol ? { currency } : {}) }),
      signed: (cents, type) => formatSignedAmount(cents, type, { grouping: true, currency }),
    }),
    [currency]
  );
}
