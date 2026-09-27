import type { TransactionType } from "shared";
import type { ParsedRow } from "./parse";

export interface ReviewRow extends ParsedRow {
  include: boolean;
  duplicate: boolean;
  categoryId: string; // "" = use the fallback for its type
}

// Category a row will actually be saved with: its own pick, else the
// fallback chosen for its type ("" = still missing).
export function effectiveCategory(row: ReviewRow, fallback: Record<TransactionType, string>): string {
  return row.categoryId || (row.type ? fallback[row.type] : "");
}
