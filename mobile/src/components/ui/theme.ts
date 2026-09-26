// Mirrors the web client's Tailwind slate/blue palette so both apps feel alike.
export const colors = {
  background: "#f8fafc", // slate-50
  surface: "#ffffff",
  border: "#e2e8f0", // slate-200
  inputBorder: "#cbd5e1", // slate-300
  text: "#0f172a", // slate-900
  textMuted: "#475569", // slate-600
  textSubtle: "#64748b", // slate-500
  primary: "#2563eb", // blue-600
  primaryPressed: "#1d4ed8", // blue-700
  danger: "#dc2626", // red-600
  positive: "#15803d", // green-700
  successBg: "#f0fdf4", // green-50
  successText: "#166534", // green-800
} as const;

export const radius = { md: 6, lg: 8 } as const;
