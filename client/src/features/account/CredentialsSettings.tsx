import { useState } from "react";
import { Link } from "react-router-dom";
import { Field } from "../../components/ui/Field";
import { buttonClass, ghostButtonClass, inputClass } from "../../components/ui/formStyles";
import { SettingsCard, StatusText } from "../../components/ui/SettingsCard";
import { useAuth } from "../../context/AuthContext";
import { extractErrorMessage } from "../../lib/errors";
import { cancelEmailChange, changePassword, confirmEmailChange, requestEmailChange } from "./api";

type Status = { kind: "ok" | "error"; text: string } | null;

export function EmailSettings() {
  const { user, setUser } = useAuth();
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setStatus(null);
    try {
      await action();
    } catch (err) {
      setStatus({ kind: "error", text: extractErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard title="Email">
      <p className="text-sm text-slate-700">
        <span className="font-medium text-slate-900">{user.email}</span>{" "}
        {user.emailVerified ? (
          <span className="ml-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">Verified</span>
        ) : (
          <Link to={`/verify-email?email=${encodeURIComponent(user.email)}`} className="ml-1 text-xs font-medium text-link hover:underline">
            Not verified — verify now
          </Link>
        )}
      </p>

      {user.pendingEmail ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const updated = await confirmEmailChange(code.trim());
              setUser(updated);
              setCode("");
              setStatus({ kind: "ok", text: `Done — you now log in with ${updated.email}.` });
            });
          }}
        >
          <p className="text-sm text-slate-600">
            Enter the 6-digit code we sent to <span className="font-medium text-slate-900">{user.pendingEmail}</span> to finish the change.
          </p>
          <Field label="6-digit code">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className={`${inputClass} tracking-[0.3em] sm:max-w-48`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy || !/^\d{6}$/.test(code.trim())} className={buttonClass}>
              Confirm new email
            </button>
            <button
              type="button"
              disabled={busy}
              className={ghostButtonClass}
              onClick={() =>
                void run(async () => {
                  setUser(await cancelEmailChange());
                  setStatus({ kind: "ok", text: "Email change cancelled." });
                })
              }
            >
              Cancel change
            </button>
          </div>
        </form>
      ) : (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const res = await requestEmailChange(newEmail.trim(), password);
              setUser(res.user);
              setPassword("");
              setNewEmail("");
              setStatus({ kind: "ok", text: res.message });
            });
          }}
        >
          <Field label="New email">
            <input type="email" autoComplete="email" className={inputClass} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </Field>
          <Field label="Current password">
            <input type="password" autoComplete="current-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy || !newEmail.trim() || !password} className={buttonClass}>
              {busy ? "Sending..." : "Send confirmation code"}
            </button>
          </div>
        </form>
      )}
      <div className="mt-3">
        <StatusText status={status} />
      </div>
    </SettingsCard>
  );
}

export function PasswordSettings() {
  const { applyAuth } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  async function submit(): Promise<void> {
    if (next.length < 8) return setStatus({ kind: "error", text: "The new password must be at least 8 characters" });
    if (next !== confirm) return setStatus({ kind: "error", text: "The new passwords don't match" });
    setBusy(true);
    setStatus(null);
    try {
      applyAuth(await changePassword({ currentPassword: current, newPassword: next }));
      setCurrent("");
      setNext("");
      setConfirm("");
      setStatus({ kind: "ok", text: "Password changed. Your other devices were signed out." });
    } catch (err) {
      setStatus({ kind: "error", text: extractErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard title="Password" description="Changing it signs you out on your other devices.">
      <form
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Current password">
          <input type="password" autoComplete="current-password" className={inputClass} value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="New password">
          <input type="password" autoComplete="new-password" className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Confirm new password">
          <input type="password" autoComplete="new-password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <div className="sm:col-span-3">
          <button type="submit" disabled={busy || !current || !next || !confirm} className={buttonClass}>
            {busy ? "Changing..." : "Change password"}
          </button>
        </div>
      </form>
      <div className="mt-3">
        <StatusText status={status} />
      </div>
    </SettingsCard>
  );
}
