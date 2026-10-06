import { describe, expect, it } from "vitest";
import {
  centsFromDecimal,
  centsToDecimalString,
  centsToUnits,
  formatMoney,
  formatSignedAmount,
  isCents,
  parseAmountInput,
  sumCents,
} from "./money";

describe("parseAmountInput", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12.50", 1250],
    ["12,50", 1250],
    ["0.01", 1],
    [".5", 50],
    ["1.", 100],
    ["  1250.50  ", 125050],
    ["0", 0],
    ["-3.10", -310],
    ["+7", 700],
  ])("%j -> %i cents", (input, cents) => {
    expect(parseAmountInput(input)).toBe(cents);
  });

  it.each(["", " ", ".", "-", "abc", "12.345", "1,250.50", "1 250", "12..5", "1e3", "0x10", "Infinity"])("rejects %j", (input) => {
    expect(parseAmountInput(input)).toBeNull();
  });

  it("never goes through floating point (no 0.29 / 1.15 style errors)", () => {
    // Number("0.29") * 100 === 28.999999999999996 and 1.15 * 100 === 114.99999999999999
    expect(parseAmountInput("0.29")).toBe(29);
    expect(parseAmountInput("1.15")).toBe(115);
    expect(parseAmountInput("4.35")).toBe(435);
  });
});

describe("centsFromDecimal", () => {
  it("rounds binary noise away", () => {
    expect(centsFromDecimal(0.1 + 0.2)).toBe(30);
    expect(centsFromDecimal(1.15)).toBe(115);
    expect(centsFromDecimal(42.5)).toBe(4250);
    expect(centsFromDecimal(1250.5)).toBe(125050);
  });

  it("rounds half up at the second decimal as written", () => {
    expect(centsFromDecimal(1.005)).toBe(101);
    expect(centsFromDecimal(2.675)).toBe(268);
    expect(centsFromDecimal(10.004)).toBe(1000);
    expect(centsFromDecimal(-1.005)).toBe(-101);
  });

  it("never returns -0", () => {
    expect(Object.is(centsFromDecimal(-0.001), 0)).toBe(true);
  });

  it("rejects non-finite values", () => {
    expect(() => centsFromDecimal(Number.NaN)).toThrow(RangeError);
    expect(() => centsFromDecimal(Infinity)).toThrow(RangeError);
  });
});

describe("formatting", () => {
  it("formats cents as plain decimals", () => {
    expect(centsToDecimalString(125050)).toBe("1250.50");
    expect(centsToDecimalString(5)).toBe("0.05");
    expect(centsToDecimalString(0)).toBe("0.00");
    expect(centsToDecimalString(-5)).toBe("-0.05");
  });

  it("formatMoney handles sign and grouping options", () => {
    expect(formatMoney(191992)).toBe("1919.92");
    expect(formatMoney(-40000)).toBe("-400.00");
    expect(formatMoney(2629, { sign: "always" })).toBe("+26.29");
    expect(formatMoney(-2629, { sign: "never" })).toBe("26.29");
    expect(formatMoney(123456789, { grouping: true })).toBe("1,234,567.89");
    expect(formatMoney(99, { grouping: true })).toBe("0.99");
  });

  it("formatSignedAmount follows the income/expense convention", () => {
    expect(formatSignedAmount(320000, "income")).toBe("+3200.00");
    expect(formatSignedAmount(2629, "expense")).toBe("-26.29");
  });

  it("centsToUnits is only a scale conversion", () => {
    expect(centsToUnits(125050)).toBe(1250.5);
  });
});

describe("sums", () => {
  it("adds integer cents exactly where floats drift", () => {
    expect(0.1 + 0.2).not.toBe(0.3); // the problem being avoided
    expect(sumCents([10, 20])).toBe(30);
    expect(formatMoney(sumCents([10, 20]))).toBe("0.30");
  });

  it("stays exact over many small amounts", () => {
    const cents = Array.from({ length: 10_000 }, () => 1); // ten thousand 0.01s
    let floatTotal = 0;
    for (let i = 0; i < 10_000; i++) floatTotal += 0.01;
    expect(floatTotal).not.toBe(100); // 100.00000000001425
    expect(sumCents(cents)).toBe(10_000);
    expect(formatMoney(sumCents(cents))).toBe("100.00");
  });

  it("isCents accepts only safe integers", () => {
    expect(isCents(1250)).toBe(true);
    expect(isCents(12.5)).toBe(false);
    expect(isCents(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    expect(isCents("1250")).toBe(false);
  });
});

describe("decimal text round trip", () => {
  it("cents -> text -> cents is lossless", () => {
    for (const cents of [0, 1, 9, 10, 99, 100, 101, 4250, 125050, 999999999]) {
      expect(parseAmountInput(centsToDecimalString(cents))).toBe(cents);
      expect(centsFromDecimal(Number(centsToDecimalString(cents)))).toBe(cents);
    }
  });
});
