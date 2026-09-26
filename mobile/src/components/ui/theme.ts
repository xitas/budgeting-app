import type { ColorScheme } from "shared";

// Mirrors the web client's Tailwind slate/blue palette so both apps feel
// alike; the dark set uses the same values as the web's `.dark` overrides.
export const lightColors = {
  background: "#f8fafc", // slate-50
  surface: "#ffffff",
  border: "#e2e8f0", // slate-200
  inputBorder: "#cbd5e1", // slate-300
  text: "#0f172a", // slate-900
  textMuted: "#475569", // slate-600
  textSubtle: "#64748b", // slate-500
  primary: "#2563eb", // blue-600 — button fills (white text on top)
  primaryPressed: "#1d4ed8", // blue-700
  onPrimary: "#ffffff",
  link: "#2563eb", // text links / text buttons
  selectedBg: "#eff6ff", // blue-50 — selected chip
  selectedText: "#1d4ed8",
  danger: "#dc2626", // red-600
  positive: "#15803d", // green-700
  successBg: "#f0fdf4", // green-50
  successText: "#166534", // green-800
  chartCursor: "#f4f4f2", // selected-band wash behind a tapped chart group
};

export type Colors = typeof lightColors;

export const darkColors: Colors = {
  background: "#0b1220",
  surface: "#161f2e",
  border: "#2a3649",
  inputBorder: "#3a475c",
  text: "#f1f5f9",
  textMuted: "#b4c0d0",
  textSubtle: "#94a3b8",
  primary: "#2563eb", // white-on-blue buttons keep enough contrast in dark
  primaryPressed: "#1d4ed8",
  onPrimary: "#ffffff",
  link: "#60a5fa", // blue-600 text would be too dim on the dark surface
  selectedBg: "#172554",
  selectedText: "#93c5fd",
  danger: "#f87171",
  positive: "#4ade80",
  successBg: "#0f2e1c",
  successText: "#86efac",
  chartCursor: "#1f2a3c",
};

export const palettes: Record<ColorScheme, Colors> = { light: lightColors, dark: darkColors };

export const radius = { md: 6, lg: 8 } as const;
