import { useQueryClient } from "@tanstack/react-query";
import { useState, type ChangeEvent } from "react";
import type { BackupPreviewResponse } from "shared";
import { Field } from "../../components/ui/Field";
import { buttonClass, ghostButtonClass, inputClass } from "../../components/ui/formStyles";
import { SettingsCard, StatusText } from "../../components/ui/SettingsCard";
import { useAuth } from "../../context/AuthContext";
import { downloadBlob } from "../../lib/download";
import { extractErrorMessage } from "../../lib/errors";
import { formatDisplayDate } from "../../lib/formatDate";
import * as authApi from "../auth/api";
import { deleteAccount, downloadBackup, importBackup, previewBackup, signOutEverywhere } from "./api";

type Status = { kind: "ok" | "error"; text: string } | null;

async function saveBackupFile(): Promise<void> {
  const blob = await downloadBackup();
  downloadBlob(blob, `budget-backup-${new Date().toISOString().slice(0, 10)}.json`);
}

function SummaryList({ preview }: { preview: BackupPreviewResponse }) {
  const { counts, dateRange, exportedAt, currency } = preview.summary;
  const rows: [string, number][] = [
    ["Transactions", counts.transactions],
    ["Categories", counts.categories],
    ["Budgets", counts.budgets],
    ["Recurring rules", counts.recurring],
    ["Loans", counts.loans],
    ["Loan repayments", counts.repayments],
  ];
  return (
    <div className="rounded-md border border-slate-200 p-3 text-sm">
      <p className="text-slate-600">
        Backup from {formatDisplayDate(exportedAt)} · currency {currency}
        {dateRange && ` · transactions ${formatDisplayDate(dateRange.from)} – ${formatDisplayDate(dateRange.to)}`}
      </p>
      <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
        {rows.map(([label, n]) => (
          <li key={label} className="flex justify-between gap-2">
            <span className="text-slate-600">{label}</span>
            <span className="font-medium tabular-nums text-slate-900">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BackupSettings() {
  const queryClient = useQueryClient();
  const { setUser } = useAuth();
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<{ name: string; data: unknown } | null>(null);
  const [preview, setPreview] = useState<BackupPreviewResponse | null>(null);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);

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

  async function pick(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setPreview(null);
    setReplaceConfirmed(false);
    await run(async () => {
      let data: unknown;
      try {
        data = JSON.parse(await picked.text());
      } catch {
        throw new Error("That file isn't a backup (it isn't valid JSON).");
      }
      setFile({ name: picked.name, data });
      setPreview(await previewBackup(data));
    });
  }

  function reset(): void {
    setFile(null);
    setPreview(null);
    setReplaceConfirmed(false);
  }

  return (
    <SettingsCard title="Your data" description="A backup is one JSON file with everything: transactions, categories, budgets, recurring rules, loans and settings.">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} className={buttonClass} onClick={() => void run(saveBackupFile)}>
            Download backup
          </button>
          <label className={`${ghostButtonClass} cursor-pointer`}>
            Restore from backup…
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void pick(e)} />
          </label>
        </div>

        {file && preview && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-900">{file.name}</p>
            <SummaryList preview={preview} />
            {preview.accountHasData ? (
              <label className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
                <input type="checkbox" className="mt-0.5" checked={replaceConfirmed} onChange={(e) => setReplaceConfirmed(e.target.checked)} />
                <span>
                  <span className="font-semibold">Replace all my current data.</span> Every transaction, category, budget, recurring rule and loan in this account is deleted and
                  replaced by the backup. This can&apos;t be undone — download a backup of the current data first if you might need it.
                </span>
              </label>
            ) : (
              <p className="text-sm text-slate-600">This account has no data of its own yet, so the backup simply fills it.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || (preview.accountHasData && !replaceConfirmed)}
                className={buttonClass}
                onClick={() =>
                  void run(async () => {
                    const { summary } = await importBackup(file.data, preview.accountHasData);
                    setUser((await authApi.me()).user); // currency comes from the backup
                    await queryClient.invalidateQueries();
                    reset();
                    setStatus({ kind: "ok", text: `Restored ${summary.counts.transactions} transactions, ${summary.counts.categories} categories and the rest of the backup.` });
                  })
                }
              >
                {busy ? "Restoring..." : preview.accountHasData ? "Replace my data with this backup" : "Restore this backup"}
              </button>
              <button type="button" disabled={busy} className={ghostButtonClass} onClick={reset}>
                Cancel
              </button>
            </div>
          </div>
        )}
        <StatusText status={status} />
      </div>
    </SettingsCard>
  );
}

export function DangerZone() {
  const { signOutLocally, user } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const [understood, setUnderstood] = useState(false);

  // The signed-in layout redirects to /login as the user clears; the notice
  // shows there.
  function leave(notice: string): void {
    queryClient.clear();
    signOutLocally(notice);
  }

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
    <SettingsCard title="Danger zone" tone="danger">
      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium text-slate-900">Sign out of all devices</p>
          <p className="text-sm text-slate-500">Ends every session, including this one, on the web and in the mobile app.</p>
          {confirmSignOut ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                onClick={() =>
                  void run(async () => {
                    await signOutEverywhere();
                    leave("Signed out on all devices.");
                  })
                }
              >
                Yes, sign out everywhere
              </button>
              <button type="button" className={ghostButtonClass} onClick={() => setConfirmSignOut(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className={`${ghostButtonClass} mt-2`} onClick={() => setConfirmSignOut(true)}>
              Sign out everywhere…
            </button>
          )}
        </div>

        <div className="border-t border-slate-200 pt-5">
          <p className="text-sm font-medium text-slate-900">Delete account</p>
          <p className="text-sm text-slate-500">Permanently deletes your account and all of its data.</p>
          {deleting ? (
            <form
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await deleteAccount(password);
                  leave("Your account and all of its data were deleted.");
                });
              }}
            >
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                This permanently deletes <span className="font-semibold">{user?.email}</span> and every transaction, category, budget, recurring rule and loan in it,
                and signs you out everywhere. It can&apos;t be undone.
              </div>
              <button type="button" disabled={busy} className={ghostButtonClass} onClick={() => void run(saveBackupFile)}>
                Download my data first
              </button>
              <Field label="Password">
                <input type="password" autoComplete="current-password" className={`${inputClass} sm:max-w-sm`} value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" className="mt-0.5" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />I understand everything will be permanently deleted.
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={busy || !password || !understood}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {busy ? "Deleting..." : "Delete my account"}
                </button>
                <button
                  type="button"
                  className={ghostButtonClass}
                  onClick={() => {
                    setDeleting(false);
                    setPassword("");
                    setUnderstood(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button type="button" className={`${ghostButtonClass} mt-2 text-red-600`} onClick={() => setDeleting(true)}>
              Delete account…
            </button>
          )}
        </div>
        <StatusText status={status} />
      </div>
    </SettingsCard>
  );
}
