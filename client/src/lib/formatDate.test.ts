import { describe, expect, it } from "vitest";
import { formatDisplayDate } from "./formatDate";

describe("formatDisplayDate", () => {
  it("formats an ISO date string as dd-Mon-yyyy", () => {
    expect(formatDisplayDate("2026-03-05T00:00:00.000Z")).toBe("05-Mar-2026");
  });

  it("pads single-digit days", () => {
    expect(formatDisplayDate("2026-12-01T00:00:00.000Z")).toBe("01-Dec-2026");
  });

  it("uses UTC getters so a midnight-UTC date never shifts to the previous day", () => {
    // A local timezone west of UTC would render this as Jun 30 if local
    // getters were used instead of UTC ones.
    expect(formatDisplayDate("2026-07-01T00:00:00.000Z")).toBe("01-Jul-2026");
  });
});
