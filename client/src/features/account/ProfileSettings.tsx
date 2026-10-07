import { useState } from "react";
import { CURRENCIES, formatMoney, type CurrencyCode } from "shared";
import { Field } from "../../components/ui/Field";
import { buttonClass, inputClass } from "../../components/ui/formStyles";
import { SettingsCard, StatusText } from "../../components/ui/SettingsCard";
import { useAuth } from "../../context/AuthContext";
import { useTheme, type ThemeMode } from "../../context/ThemeContext";
import { extractErrorMessage } from "../../lib/errors";
import { updateProfile } from "./api";

type Status = { kind: "ok" | "error"; text: string } | null;

export function ProfileSettings() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [status, setStatus] = useState<Status>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function saveName(): Promise<void> {
    if (!name.trim()) {
      setStatus({ kind: "error", text: "Name is required" });
      return;
    }
    setIsSaving(true);
    try {
      setUser(await updateProfile({ name: name.trim() }));
      setStatus({ kind: "ok", text: "Name saved." });
    } catch (err) {
      setStatus({ kind: "error", text: extractErrorMessage(err) });
    } finally {
      setIsSaving(false);
    }
  }

  async function saveCurrency(currency: CurrencyCode): Promise<void> {
    try {
      setUser(await updateProfile({ currency }));
      setStatus({ kind: "ok", text: `Amounts now show in ${currency}.` });
    } catch (err) {
      setStatus({ kind: "error", text: extractErrorMessage(err) });
    }
  }

  return (
    <SettingsCard title="Profile">
      <div className="space-y-4">
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void saveName();
          }}
        >
          <div className="flex-1">
            <Field label="Name">
              <input type="text" autoComplete="name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <button type="submit" disabled={isSaving || name.trim() === user?.name} className={buttonClass}>
            {isSaving ? "Saving..." : "Save name"}
          </button>
        </form>
        <Field label="Currency">
          <select className={inputClass} value={user?.currency} onChange={(e) => void saveCurrency(e.target.value as CurrencyCode)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name} ({formatMoney(125050, { currency: c.code, grouping: true })})
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-slate-500">Changes how amounts are shown; the numbers themselves don&apos;t change. CSV files keep plain numbers.</p>
        <StatusText status={status} />
      </div>
    </SettingsCard>
  );
}

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

// Same setting as the header toggle (and the mobile app's Appearance).
export function AppearanceSettings() {
  const { mode, setMode } = useTheme();
  return (
    <SettingsCard title="Appearance" description="System follows your device's light/dark setting.">
      <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-full bg-slate-100 p-1">
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={mode === option.value}
            onClick={() => setMode(option.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === option.value ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </SettingsCard>
  );
}
