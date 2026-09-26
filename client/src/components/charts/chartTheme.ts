import { CATEGORICAL_PALETTE } from "shared";
import { useSchemeColor, useTheme } from "../../context/ThemeContext";

// Chart chrome per scheme: recessive hairline grid, muted axis text, and a
// hover band one step off the card surface. Dark values are picked for the
// dark card (#161f2e), not flipped from the light ones.
const CHROME = {
  light: { grid: "#e1e0d9", axis: "#898781", cursor: "#f4f4f2" },
  dark: { grid: "#2a3649", axis: "#7c8aa0", cursor: "#1f2a3c" },
} as const;

// Over-budget reuses the palette's red slot, so it steps with the scheme too.
const OVER_BUDGET = CATEGORICAL_PALETTE[7];

export function useChartTheme() {
  const { scheme } = useTheme();
  const color = useSchemeColor();
  return { ...CHROME[scheme], color, overBudget: color(OVER_BUDGET) };
}
