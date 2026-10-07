import { describe, expect, it } from "vitest";
import type { Category } from "../index";
import { buildRows } from "./parse";
import { loadCsvForImport, MAX_IMPORT_FILE_ROWS, reviewCounts, rowsForDuplicateCheck, rowsToImport, toReviewRows } from "./review";

const categories: Category[] = [
  { id: "g", name: "Groceries", type: "expense", color: "#000", isDefault: true },
  { id: "s", name: "Salary", type: "income", color: "#000", isDefault: true },
];

const csv = "Date,Description,Amount,Category\n01/07/2026,TESCO,-42.50,groceries\n02/07/2026,PAY,3000.00,Salary\n03/07/2026,CAFE,-3.20,Coffee\n04/07/2026,BAD,,\n";

describe("import flow helpers", () => {
  it("loads a file and guesses mapping, date format and decimals", () => {
    const loaded = loadCsvForImport(csv, "en-GB");
    if ("error" in loaded) throw new Error(loaded.error);
    expect(loaded.headers).toEqual(["Date", "Description", "Amount", "Category"]);
    expect(loaded.mapping).toMatchObject({ date: 0, description: 1, amount: 2, category: 3, amountMode: "signed" });
    expect(loaded.options).toEqual({ dateFormat: "DD/MM/YYYY", decimal: ".", invertSigns: false });
    expect(loaded.dateAmbiguous).toBe(true); // 01/07 could be either way round; locale decided
  });

  it("explains empty and oversized files", () => {
    expect(loadCsvForImport("Date,Amount\n")).toEqual({ error: expect.stringMatching(/no rows/) });
    const big = "Date,Amount\n" + "2026-07-01,1\n".repeat(MAX_IMPORT_FILE_ROWS + 1);
    expect(loadCsvForImport(big)).toEqual({ error: expect.stringMatching(/split it/) });
  });

  it("flags duplicates, matches categories by name and type, and keeps error rows out", () => {
    const loaded = loadCsvForImport(csv, "en-GB");
    if ("error" in loaded) throw new Error(loaded.error);
    const parsed = buildRows(loaded.dataRows, loaded.mapping, loaded.options);
    const toCheck = rowsForDuplicateCheck(parsed);
    expect(toCheck).toEqual([
      { date: "2026-07-01", type: "expense", amountCents: 4250, description: "TESCO" },
      { date: "2026-07-02", type: "income", amountCents: 300000, description: "PAY" },
      { date: "2026-07-03", type: "expense", amountCents: 320, description: "CAFE" },
    ]);

    const rows = toReviewRows(parsed, [1], categories); // the server says PAY already exists
    expect(rows.map((r) => [r.description, r.include, r.duplicate, r.categoryId, r.error])).toEqual([
      ["TESCO", true, false, "g", null],
      ["PAY", false, true, "s", null],
      ["CAFE", true, false, "", null], // "Coffee" isn't a category
      ["BAD", false, false, "", "Missing or unrecognised amount"],
    ]);

    const none = { expense: "", income: "" };
    expect(reviewCounts(rows, none)).toEqual({ selected: 2, missingCategory: 1, duplicates: 1, invalid: 1, needsFallback: { expense: true, income: false } });
    expect(reviewCounts(rows, { ...none, expense: "g" }).missingCategory).toBe(0);

    expect(rowsToImport(rows, { ...none, expense: "g" })).toEqual([
      { date: "2026-07-01", type: "expense", amountCents: 4250, description: "TESCO", category: "g" },
      { date: "2026-07-03", type: "expense", amountCents: 320, description: "CAFE", category: "g" },
    ]);
  });
});
