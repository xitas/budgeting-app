export type CsvCell = string | number | null | undefined;

// Spreadsheet apps execute a text cell that starts with one of these as a
// formula ("CSV injection") — e.g. a description of `=HYPERLINK(...)`.
// Prefixing a single quote makes Excel/Sheets show it as plain text.
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) {
    return "";
  }
  if (typeof cell === "number") {
    return String(cell);
  }
  const text = FORMULA_TRIGGERS.test(cell) ? `'${cell}` : cell;
  // RFC 4180: quote fields containing a delimiter, quote or line break, and
  // double any embedded quotes.
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// CRLF line endings per RFC 4180. The leading byte-order mark makes Excel
// open the file as UTF-8 (otherwise names like "Café" come out garbled).
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
