import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance, useColorScheme } from "react-native";
import { schemeColor, type ColorScheme } from "shared";
import { palettes, type Colors } from "../components/ui/theme";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "themeMode";

interface ThemeContextValue {
  mode: ThemeMode; // what the user picked
  scheme: ColorScheme; // what's actually showing
  colors: Colors;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Forcing Appearance (rather than only swapping our own colors) also themes
// native UI we don't style: date pickers, alerts, the keyboard.
function applyMode(mode: ThemeMode): void {
  Appearance.setColorScheme(mode === "system" ? "unspecified" : mode);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const scheme: ColorScheme = useColorScheme() === "dark" ? "dark" : "light";

  useEffect(() => {
    // Restore the saved choice; a failed read just means "follow the system".
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((stored) => {
        if (stored === "light" || stored === "dark") {
          applyMode(stored);
          setModeState(stored);
        }
      })
      .catch(() => {});
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    applyMode(next);
    setModeState(next);
    const write = next === "system" ? SecureStore.deleteItemAsync(STORAGE_KEY) : SecureStore.setItemAsync(STORAGE_KEY, next);
    write.catch(() => {});
  }, []);

  const value = useMemo(() => ({ mode, scheme, colors: palettes[scheme], setMode }), [mode, scheme, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}

export function useColors(): Colors {
  return useTheme().colors;
}

// Styles are built per scheme from a factory and memoized, so a component
// keeps a stable StyleSheet until the theme actually changes.
export function useThemedStyles<T>(factory: (colors: Colors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}

// Maps a stored category/palette color to the current scheme's step.
export function useSchemeColor(): (hex: string) => string {
  const { scheme } = useTheme();
  return useCallback((hex: string) => schemeColor(hex, scheme), [scheme]);
}
