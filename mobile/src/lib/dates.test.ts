import { describe, expect, it } from "vitest";
import { niceCeiling } from "../components/charts/chartUtils";
import { datePresetRange, formatDisplayDate, isoToLocalDate, localDateToIso, shiftMonth, shortMonthLabel } from "./dates";

describe("shiftMonth", () => {
  it("rolls over year boundaries in both directions", () => {
    expect(shiftMonth(12, 2026, 1)).toEqual({ month: 1, year: 2027 });
    expect(shiftMonth(1, 2026, -1)).toEqual({ month: 12, year: 2025 });
    expect(shiftMonth(6, 2026, 0)).toEqual({ month: 6, year: 2026 });
    expect(shiftMonth(3, 2026, -15)).toEqual({ month: 12, year: 2024 });
  });
});

describe("date conversions", () => {
  it("round-trips a calendar day through the native picker's local Date", () => {
    for (const iso of ["2026-01-01", "2026-03-29", "2026-12-31"]) {
      expect(localDateToIso(isoToLocalDate(iso))).toBe(iso);
    }
  });

  it("formats server dates (midnight UTC) as dd-Mon-yyyy without a timezone shift", () => {
    expect(formatDisplayDate("2026-09-01T00:00:00.000Z")).toBe("01-Sep-2026");
  });

  it("labels trend months", () => {
    expect(shortMonthLabel("2026-01")).toBe("Jan");
  });
});

describe("niceCeiling", () => {
  it("rounds an axis max up to a clean value", () => {
    expect(niceCeiling(874)).toBe(1000);
    expect(niceCeiling(1200)).toBe(2000);
    expect(niceCeiling(2400)).toBe(2500);
    expect(niceCeiling(50)).toBe(50);
    expect(niceCeiling(0)).toBe(1);
  });
});

describe("datePresetRange", () => {
  const today = new Date(2026, 9, 7); // 7 Oct 2026, local

  it("covers whole calendar months, inclusive", () => {
    expect(datePresetRange("thisMonth", today)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(datePresetRange("lastMonth", today)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(datePresetRange("last3Months", today)).toEqual({ from: "2026-08-01", to: "2026-10-31" });
  });

  it("handles year boundaries and February", () => {
    expect(datePresetRange("lastMonth", new Date(2026, 0, 15))).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(datePresetRange("last3Months", new Date(2026, 1, 3))).toEqual({ from: "2025-12-01", to: "2026-02-28" });
    expect(datePresetRange("thisMonth", new Date(2028, 1, 10))).toEqual({ from: "2028-02-01", to: "2028-02-29" }); // leap year
  });

  it("has no bounds for all time and custom", () => {
    expect(datePresetRange("all", today)).toEqual({});
    expect(datePresetRange("custom", today)).toEqual({});
  });
});
