import { useTheme, type ThemeMode } from "../context/ThemeContext";
import { MonitorIcon, MoonIcon, SunIcon } from "./ui/icons";

const NEXT: Record<ThemeMode, ThemeMode> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<ThemeMode, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };

// One button cycling System -> Light -> Dark; the icon shows the current mode.
export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const Icon = mode === "light" ? SunIcon : mode === "dark" ? MoonIcon : MonitorIcon;

  return (
    <button
      type="button"
      onClick={() => setMode(NEXT[mode])}
      aria-label={`${LABEL[mode]} (click for ${LABEL[NEXT[mode]].toLowerCase()})`}
      title={`${LABEL[mode]} — click to switch`}
      className="rounded-md border border-slate-300 p-1.5 text-slate-600 transition-colors hover:bg-slate-100"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
