import { centsFromDecimal, parseAmountInput, type TransactionType } from "shared";

// Everything here is pure: file text in, typed rows out. The import page
// wires it to the UI; the tests pin down the fiddly parts (quoting, date and
// number formats, column guessing).

// ---------------------------------------------------------------- CSV

export type Delimiter = "," | ";" | "\t";

// Banks in comma-decimal locales usually export with ";" — pick whichever
// candidate splits the header line into the most columns.
export function detectDelimiter(text: string): Delimiter {
  const firstLine = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  const counts = ([",", ";", "\t"] as const).map((d) => ({ d, n: countOutsideQuotes(firstLine, d) }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ",";
}

function countOutsideQuotes(line: string, ch: string): number {
  let inQuotes = false;
  let n = 0;
  for (const c of line) {
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ch && !inQuotes) n++;
  }
  return n;
}

// RFC 4180: quoted fields may contain the delimiter, doubled quotes and line
// breaks. Strips a UTF-8 BOM and drops fully blank lines.
export function parseCsv(text: string, delimiter: Delimiter = detectDelimiter(text)): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// ---------------------------------------------------------------- Dates

export type DateFormat = "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY" | "DD-Mon-YYYY";

export const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: "YYYY-MM-DD", label: "2026-12-31" },
  { value: "DD/MM/YYYY", label: "31/12/2026 (day first)" },
  { value: "MM/DD/YYYY", label: "12/31/2026 (month first)" },
  { value: "DD-Mon-YYYY", label: "31-Dec-2026" },
];

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1) return null;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > daysInMonth) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

// Separators are interchangeable (/ . -) so "31.12.2026" parses as
// DD/MM/YYYY. A trailing time ("2026-07-01 14:03") is ignored.
export function parseDate(raw: string, format: DateFormat): string | null {
  const value = raw.trim().split(/[ T]/)[0];
  if (format === "DD-Mon-YYYY") {
    const m = /^(\d{1,2})[-/. ]([A-Za-z]{3})[A-Za-z]*[-/. ](\d{2}|\d{4})$/.exec(raw.trim());
    if (!m) return null;
    const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
    return month ? toIso(Number(m[3]), month, Number(m[1])) : null;
  }
  const parts = value.split(/[-/.]/).map(Number);
  if (parts.length !== 3 || parts.some((p) => !Number.isInteger(p))) return null;
  const [a, b, c] = parts;
  if (format === "YYYY-MM-DD") return value.split(/[-/.]/)[0].length === 4 ? toIso(a, b, c) : null;
  if (format === "DD/MM/YYYY") return toIso(c, b, a);
  return toIso(c, a, b); // MM/DD/YYYY
}

// The format that parses the most samples — not all of them, so one bad row
// (e.g. "31/09") can't knock out the right format for the whole file; that
// row just shows up as an error. Ties go to the order of preference.
// Day-first and month-first tie when every day is <= 12 — then the
// browser's locale decides, and the page lets the user override it.
export function detectDateFormat(samples: string[], locale = "en-GB"): { format: DateFormat; ambiguous: boolean } {
  const values = samples.filter((s) => s.trim() !== "");
  const score = (f: DateFormat) => values.filter((v) => parseDate(v, f) !== null).length;
  const monthFirstLocale = /^en-US|^en-PH|^fil/i.test(locale);
  const order: DateFormat[] = monthFirstLocale
    ? ["YYYY-MM-DD", "DD-Mon-YYYY", "MM/DD/YYYY", "DD/MM/YYYY"]
    : ["YYYY-MM-DD", "DD-Mon-YYYY", "DD/MM/YYYY", "MM/DD/YYYY"];
  const scores = new Map(order.map((f) => [f, score(f)]));
  const best = Math.max(...scores.values());
  if (best === 0) return { format: "YYYY-MM-DD", ambiguous: false };
  const format = order.find((f) => scores.get(f) === best)!;
  const ambiguous = scores.get("DD/MM/YYYY") === best && scores.get("MM/DD/YYYY") === best;
  return { format, ambiguous };
}

// ---------------------------------------------------------------- Amounts

export type DecimalSeparator = "." | ",";

// "1,234.56" -> "."; "1.234,56" or "12,50" -> ",". Decided per file from the
// last separator in each sample; ties go to ".".
export function detectDecimalSeparator(samples: string[]): DecimalSeparator {
  let comma = 0;
  let dot = 0;
  for (const s of samples) {
    const digits = s.replace(/[^\d.,]/g, "");
    const lastComma = digits.lastIndexOf(",");
    const lastDot = digits.lastIndexOf(".");
    if (lastComma > lastDot && /,\d{1,2}$/.test(digits)) comma++;
    else if (lastDot > lastComma) dot++;
  }
  return comma > dot ? "," : ".";
}

// Signed amount in integer cents, or null. Handles currency symbols and
// codes, spaces and thousands separators, "(45.00)" and trailing-minus
// negatives. Converted from the cleaned-up text, not via a float, so
// "0.29" is exactly 29; more than 2 decimals round half up.
export function parseAmountCents(raw: string, decimal: DecimalSeparator): number | null {
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/-\s*$/.test(s)) {
    negative = true;
    s = s.replace(/-\s*$/, "");
  }
  if (s.includes("-")) negative = !negative;
  const thousands = decimal === "." ? "," : ".";
  s = s.replace(/[^\d.,]/g, "").split(thousands).join("");
  if (decimal === ",") s = s.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const cents = parseAmountInput(s) ?? centsFromDecimal(Number(s));
  return negative ? -cents : cents;
}

// ---------------------------------------------------------------- Mapping

export type AmountMode = "signed" | "debitCredit";

export interface ColumnMapping {
  date: number;
  description: number; // -1 = none
  amountMode: AmountMode;
  amount: number; // signed mode
  debit: number; // debitCredit mode
  credit: number;
  type: number; // optional "income"/"expense" column (this app's export); -1 = none
  category: number; // optional category-name column; -1 = none
}

const NONE = -1;

function findColumn(headers: string[], patterns: RegExp[]): number {
  for (const p of patterns) {
    const i = headers.findIndex((h) => p.test(h.trim()));
    if (i !== -1) return i;
  }
  return NONE;
}

// Guesses from common bank header names; anything missed is picked by the
// user on the mapping step.
export function guessMapping(headers: string[]): ColumnMapping {
  const debit = findColumn(headers, [/^debit/i, /paid out/i, /money out/i, /withdraw/i]);
  const credit = findColumn(headers, [/^credit/i, /paid in/i, /money in/i, /deposit/i]);
  const amount = findColumn(headers, [/^amount/i, /^value$/i, /amount/i]);
  return {
    date: findColumn(headers, [/^date$/i, /transaction date/i, /posting date/i, /booking date/i, /date/i]),
    description: findColumn(headers, [/^description$/i, /details/i, /narrative/i, /memo/i, /payee/i, /merchant/i, /description/i, /reference/i, /^name$/i]),
    amountMode: amount === NONE && debit !== NONE && credit !== NONE ? "debitCredit" : "signed",
    amount,
    debit,
    credit,
    type: findColumn(headers, [/^type$/i]),
    category: findColumn(headers, [/^category$/i]),
  };
}

export interface ParseOptions {
  dateFormat: DateFormat;
  decimal: DecimalSeparator;
  // Some banks list spending as positive numbers: flip so it reads as expense.
  invertSigns: boolean;
}

export interface ParsedRow {
  line: number; // 1-based line in the file (header = 1), for error messages
  date: string | null;
  type: TransactionType | null;
  amountCents: number | null; // always positive
  description: string;
  categoryName: string;
  error: string | null;
}

function typeFromColumn(value: string): TransactionType | null {
  const v = value.trim().toLowerCase();
  if (["income", "credit", "cr", "in", "deposit"].includes(v)) return "income";
  if (["expense", "debit", "dr", "out", "withdrawal", "payment"].includes(v)) return "expense";
  return null;
}

export function buildRows(dataRows: string[][], mapping: ColumnMapping, options: ParseOptions): ParsedRow[] {
  return dataRows.map((cells, i) => {
    const cell = (idx: number) => (idx >= 0 ? (cells[idx] ?? "").trim() : "");
    const row: ParsedRow = {
      line: i + 2,
      date: null,
      type: null,
      amountCents: null,
      description: cell(mapping.description),
      categoryName: cell(mapping.category),
      error: null,
    };

    row.date = parseDate(cell(mapping.date), options.dateFormat);
    if (!row.date) {
      return { ...row, error: cell(mapping.date) ? `Unrecognised date "${cell(mapping.date)}"` : "Missing date" };
    }

    let signed: number | null;
    if (mapping.amountMode === "debitCredit") {
      const debit = parseAmountCents(cell(mapping.debit), options.decimal);
      const credit = parseAmountCents(cell(mapping.credit), options.decimal);
      signed = debit || credit ? (credit ?? 0) - Math.abs(debit ?? 0) : null;
    } else {
      signed = parseAmountCents(cell(mapping.amount), options.decimal);
    }
    if (signed === null) {
      return { ...row, error: "Missing or unrecognised amount" };
    }
    if (options.invertSigns) signed = -signed;
    if (signed === 0) {
      return { ...row, error: "Amount is zero" };
    }

    // An explicit type column (this app's export) wins; otherwise the sign.
    const typed = mapping.type >= 0 ? typeFromColumn(cell(mapping.type)) : null;
    if (mapping.type >= 0 && !typed) {
      return { ...row, error: `Unrecognised type "${cell(mapping.type)}"` };
    }
    row.type = typed ?? (signed < 0 ? "expense" : "income");
    row.amountCents = Math.abs(signed);
    return row;
  });
}
