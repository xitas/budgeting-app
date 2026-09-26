import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { schemeColor, type ColorScheme } from "shared";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

interface ThemeContextValue {
  mode: ThemeMode; // what the user picked
  scheme: ColorScheme; // what's actually showing
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Storage can throw (private mode, blocked site data) — the theme is a
// convenience, so failures just fall back to following the system.
function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function storeMode(mode: ThemeMode): void {
  try {
    if (mode === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

function systemScheme(): ColorScheme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [system, setSystem] = useState<ColorScheme>(systemScheme);
  const scheme: ColorScheme = mode === "system" ? system : mode;

  // Follow OS changes live while in "system" mode.
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => setSystem(media.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", scheme === "dark");
  }, [scheme]);

  const setMode = useCallback((next: ThemeMode) => {
    storeMode(next);
    setModeState(next);
  }, []);

  return <ThemeContext.Provider value={{ mode, scheme, setMode }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}

// Maps a stored category/palette color to the current scheme's step.
export function useSchemeColor(): (hex: string) => string {
  const { scheme } = useTheme();
  return useCallback((hex: string) => schemeColor(hex, scheme), [scheme]);
}
