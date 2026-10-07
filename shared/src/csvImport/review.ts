import type { Category, ImportCheckRow, ImportTransactionRow, TransactionType } from "../index";
import {
  detectDateFormat,
  detectDecimalSeparator,
  guessMapping,
  parseCsv,
  type ColumnMapping,
  type ParsedRow,
  type ParseOptions,
} from "./parse";

// The import flow's data handling, shared by the web and mobile screens so
// both read files, flag duplicates and build the import request identically:
//   loadCsvForImport -> (user adjusts mapping/options) -> buildRows
//   -> rowsForDuplicateCheck -> toReviewRows -> (user reviews) -> rowsToImport

// Server-side cap per request (MAX_IMPORT_ROWS); larger files must be split.
export const MAX_IMPORT_FILE_ROWS = 5000;

export interface ReviewRow extends ParsedRow {
  include: boolean;
  duplicate: boolean;
  categoryId: string; // "" = use the fallback for its type
}

export interface LoadedCsv {
  headers: string[];
  dataRows: string[][];
  mapping: ColumnMapping;
  options: ParseOptions;
  // The date column fits more than one format (e.g. 01/02/2026): ask.
  dateAmbiguous: boolean;
}

// Parses the file and guesses the column mapping, date format and decimal
// separator. `locale` breaks day/month ties (the device's language).
export function loadCsvForImport(text: string, locale?: string): LoadedCsv | { error: string } {
  const table = parseCsv(text);
  if (table.length < 2) return { error: "That file has no rows under its header line. Is it a CSV export?" };
  const [headers, ...dataRows] = table;
  if (dataRows.length > MAX_IMPORT_FILE_ROWS) {
    return { error: `That file has ${dataRows.length} rows — split it into files of at most ${MAX_IMPORT_FILE_ROWS}.` };
  }
  const mapping = guessMapping(headers);
  const column = (idx: number) => (idx >= 0 ? dataRows.map((r) => r[idx] ?? "").slice(0, 200) : []);
  const detected = detectDateFormat(column(mapping.date), locale);
  return {
    headers,
    dataRows,
    mapping,
    options: {
      dateFormat: detected.format,
      decimal: detectDecimalSeparator([...column(mapping.amount), ...column(mapping.debit), ...column(mapping.credit)]),
      invertSigns: false,
    },
    dateAmbiguous: detected.ambiguous,
  };
}

// The valid rows, in the shape POST /transactions/import/check expects.
export function rowsForDuplicateCheck(parsed: ParsedRow[]): ImportCheckRow[] {
  return parsed
    .filter((r) => !r.error)
    .map((r) => ({ date: r.date!, type: r.type!, amountCents: r.amountCents!, description: r.description }));
}

// Review rows: duplicates (indexes into rowsForDuplicateCheck's list) start
// unticked, error rows can't be ticked, and a category column value matches
// one of the user's categories of the same type by name (case-insensitive).
export function toReviewRows(parsed: ParsedRow[], duplicateIndexes: number[], categories: Category[]): ReviewRow[] {
  const valid = parsed.filter((r) => !r.error);
  const duplicateLines = new Set(duplicateIndexes.map((i) => valid[i]?.line));
  return parsed.map((r) => {
    const duplicate = duplicateLines.has(r.line);
    const match = r.categoryName
      ? categories.find((c) => c.type === r.type && c.name.toLowerCase() === r.categoryName.toLowerCase())
      : undefined;
    return { ...r, duplicate, include: !r.error && !duplicate, categoryId: match?.id ?? "" };
  });
}

// Category a row will actually be saved with: its own pick, else the
// fallback chosen for its type ("" = still missing).
export function effectiveCategory(row: ReviewRow, fallback: Record<TransactionType, string>): string {
  return row.categoryId || (row.type ? fallback[row.type] : "");
}

export interface ReviewCounts {
  selected: number;
  missingCategory: number;
  duplicates: number;
  invalid: number;
  // Types with ticked rows that have no category of their own.
  needsFallback: Record<TransactionType, boolean>;
}

export function reviewCounts(rows: ReviewRow[], fallback: Record<TransactionType, string>): ReviewCounts {
  const selected = rows.filter((r) => r.include);
  const unmatched = selected.filter((r) => !r.categoryId);
  return {
    selected: selected.length,
    missingCategory: selected.filter((r) => !effectiveCategory(r, fallback)).length,
    duplicates: rows.filter((r) => r.duplicate).length,
    invalid: rows.filter((r) => r.error).length,
    needsFallback: { expense: unmatched.some((r) => r.type === "expense"), income: unmatched.some((r) => r.type === "income") },
  };
}

// The ticked rows, in the shape POST /transactions/import expects.
export function rowsToImport(rows: ReviewRow[], fallback: Record<TransactionType, string>): ImportTransactionRow[] {
  return rows
    .filter((r) => r.include)
    .map((r) => ({ date: r.date!, type: r.type!, amountCents: r.amountCents!, description: r.description, category: effectiveCategory(r, fallback) }));
}

