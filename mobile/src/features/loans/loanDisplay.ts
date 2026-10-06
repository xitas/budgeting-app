import { CATEGORICAL_PALETTE, formatMoney, type Loan } from "shared";

// Same hues as the web Loans tab: lent = aqua, borrowed = orange.
export const LENT_COLOR = CATEGORICAL_PALETTE[2];
export const BORROWED_COLOR = CATEGORICAL_PALETTE[1];

export function loanColor(loan: Pick<Loan, "direction">): string {
  return loan.direction === "lent" ? LENT_COLOR : BORROWED_COLOR;
}

export function describeLoanState(loan: Loan): string {
  if (loan.status === "written_off") {
    return loan.direction === "lent" ? "Written off" : "Forgiven";
  }
  if (loan.outstandingCents < 0) {
    return `Overpaid by ${formatMoney(loan.outstandingCents, { sign: "never" })}`;
  }
  if (loan.outstandingCents === 0) {
    return "Settled";
  }
  return `${formatMoney(loan.outstandingCents)} remaining`;
}
