import { describe, expect, it } from "vitest";
import {
  buildRows,
  detectDateFormat,
  detectDecimalSeparator,
  detectDelimiter,
  guessMapping,
  parseAmountCents,
  parseCsv,
  parseDate,
  type ParseOptions,
} from "./parse";

describe("parseCsv", () => {
  it("handles quotes, embedded delimiters/newlines, CRLF, a BOM and blank lines", () => {
    const text = '﻿Date,Description,Amount\r\n2026-07-01,"Dinner, drinks",-45.5\r\n\r\n2026-07-02,"He said ""hi""\nthen left",10\r\n';
    expect(parseCsv(text)).toEqual([
      ["Date", "Description", "Amount"],
      ["2026-07-01", "Dinner, drinks", "-45.5"],
      ["2026-07-02", 'He said "hi"\nthen left', "10"],
    ]);
  });

  it("detects semicolon- and tab-separated files", () => {
    expect(detectDelimiter("Datum;Omschrijving;Bedrag\n01-07-2026;Albert Heijn;-12,50")).toBe(";");
    expect(detectDelimiter("Date\tDetails\tAmount\n")).toBe("\t");
    expect(detectDelimiter('Date,"Details; misc",Amount')).toBe(",");
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("dates", () => {
  it("parses each supported format, with any separator, into ISO days", () => {
    expect(parseDate("2026-07-01", "YYYY-MM-DD")).toBe("2026-07-01");
    expect(parseDate("2026-07-01 14:03:00", "YYYY-MM-DD")).toBe("2026-07-01");
    expect(parseDate("31/12/2026", "DD/MM/YYYY")).toBe("2026-12-31");
    expect(parseDate("31.12.2026", "DD/MM/YYYY")).toBe("2026-12-31");
    expect(parseDate("12/31/2026", "MM/DD/YYYY")).toBe("2026-12-31");
    expect(parseDate("5/1/26", "DD/MM/YYYY")).toBe("2026-01-05");
    expect(parseDate("09-Sep-2026", "DD-Mon-YYYY")).toBe("2026-09-09");
    expect(parseDate("9 September 2026", "DD-Mon-YYYY")).toBe("2026-09-09");
  });

  it("rejects impossible or mismatched dates", () => {
    expect(parseDate("31/02/2026", "DD/MM/YYYY")).toBeNull();
    expect(parseDate("12/31/2026", "DD/MM/YYYY")).toBeNull();
    expect(parseDate("01/07/2026", "YYYY-MM-DD")).toBeNull();
    expect(parseDate("", "YYYY-MM-DD")).toBeNull();
  });

  it("detects the format, and flags day/month ambiguity", () => {
    expect(detectDateFormat(["2026-07-01", "2026-07-15"])).toEqual({ format: "YYYY-MM-DD", ambiguous: false });
    expect(detectDateFormat(["13/07/2026", "01/08/2026"])).toEqual({ format: "DD/MM/YYYY", ambiguous: false });
    expect(detectDateFormat(["07/13/2026", "08/01/2026"])).toEqual({ format: "MM/DD/YYYY", ambiguous: false });
    // every day <= 12: both fit, locale breaks the tie
    expect(detectDateFormat(["01/07/2026", "02/07/2026"], "en-GB")).toEqual({ format: "DD/MM/YYYY", ambiguous: true });
    expect(detectDateFormat(["01/07/2026", "02/07/2026"], "en-US")).toEqual({ format: "MM/DD/YYYY", ambiguous: true });
  });

  it("isn't thrown off by one bad date in the file", () => {
    // 31/09 doesn't exist; the other rows are clearly day-first.
    expect(detectDateFormat(["01/09/2026", "15/09/2026", "31/09/2026"])).toEqual({ format: "DD/MM/YYYY", ambiguous: false });
  });
});

describe("amounts", () => {
  it("parses dot- and comma-decimal amounts with currency, thousands and negatives", () => {
    expect(parseAmountCents("1,234.56", ".")).toBe(123456);
    expect(parseAmountCents("-£45.00", ".")).toBe(-4500);
    expect(parseAmountCents("(45.00)", ".")).toBe(-4500);
    expect(parseAmountCents("45.00-", ".")).toBe(-4500);
    expect(parseAmountCents("USD 12", ".")).toBe(1200);
    expect(parseAmountCents("1.234,56", ",")).toBe(123456);
    expect(parseAmountCents("-12,50 €", ",")).toBe(-1250);
    expect(parseAmountCents("", ".")).toBeNull();
    expect(parseAmountCents("n/a", ".")).toBeNull();
  });

  it("converts to cents exactly, without float error", () => {
    // Number("0.29") * 100 is 28.999999999999996 — must still be 29.
    expect(parseAmountCents("0.29", ".")).toBe(29);
    expect(parseAmountCents("1.15", ".")).toBe(115);
    expect(parseAmountCents("1250.50", ".")).toBe(125050);
    expect(parseAmountCents("1250,5", ",")).toBe(125050);
  });

  it("rounds amounts with more than 2 decimals half up", () => {
    expect(parseAmountCents("10.005", ".")).toBe(1001);
    expect(parseAmountCents("10.004", ".")).toBe(1000);
    expect(parseAmountCents("-2.675", ".")).toBe(-268);
  });

  it("detects the decimal separator from samples", () => {
    expect(detectDecimalSeparator(["1,234.56", "-45.00", "12"])).toBe(".");
    expect(detectDecimalSeparator(["-12,50", "1.234,56", "3"])).toBe(",");
  });
});

describe("guessMapping + buildRows", () => {
  const dot: ParseOptions = { dateFormat: "YYYY-MM-DD", decimal: ".", invertSigns: false };

  it("round-trips this app's own export (type column + positive amounts)", () => {
    const [headers, ...data] = parseCsv(
      "Date,Type,Category,Description,Amount,Source\r\n2026-07-01,income,Salary,July pay,3000,manual\r\n2026-07-02,expense,Groceries,\"Weekly shop, big\",42.5,import\r\n"
    );
    const mapping = guessMapping(headers);
    expect(mapping).toMatchObject({ date: 0, type: 1, category: 2, description: 3, amountMode: "signed", amount: 4 });

    expect(buildRows(data, mapping, dot)).toEqual([
      { line: 2, date: "2026-07-01", type: "income", amountCents: 300000, description: "July pay", categoryName: "Salary", error: null },
      { line: 3, date: "2026-07-02", type: "expense", amountCents: 4250, description: "Weekly shop, big", categoryName: "Groceries", error: null },
    ]);
  });

  it("reads a signed-amount bank statement (negative = expense), optionally inverted", () => {
    const [headers, ...data] = parseCsv("Transaction Date,Details,Amount\n01/07/2026,TESCO,-42.50\n02/07/2026,SALARY,3000.00");
    const mapping = guessMapping(headers);
    const options: ParseOptions = { dateFormat: "DD/MM/YYYY", decimal: ".", invertSigns: false };

    const rows = buildRows(data, mapping, options);
    expect(rows.map((r) => [r.date, r.type, r.amountCents, r.description])).toEqual([
      ["2026-07-01", "expense", 4250, "TESCO"],
      ["2026-07-02", "income", 300000, "SALARY"],
    ]);

    const inverted = buildRows(data, mapping, { ...options, invertSigns: true });
    expect(inverted.map((r) => r.type)).toEqual(["income", "expense"]);
  });

  it("reads separate debit/credit columns", () => {
    const [headers, ...data] = parseCsv("Date;Description;Paid out;Paid in\n2026-07-01;Rent;1.200,00;\n2026-07-02;Refund;;12,50");
    const mapping = guessMapping(headers);
    expect(mapping.amountMode).toBe("debitCredit");

    const rows = buildRows(data, mapping, { dateFormat: "YYYY-MM-DD", decimal: ",", invertSigns: false });
    expect(rows.map((r) => [r.type, r.amountCents])).toEqual([
      ["expense", 120000],
      ["income", 1250],
    ]);
  });

  it("reports per-row errors with file line numbers instead of dropping rows", () => {
    const [headers, ...data] = parseCsv("Date,Description,Amount\n2026-02-30,Bad date,-1\n2026-07-01,No amount,\n2026-07-02,Zero,0");
    const rows = buildRows(data, guessMapping(headers), dot);
    expect(rows.map((r) => [r.line, r.error])).toEqual([
      [2, 'Unrecognised date "2026-02-30"'],
      [3, "Missing or unrecognised amount"],
      [4, "Amount is zero"],
    ]);
  });
});
