import type { ReactNode } from "react";

export function SettingsCard({ title, description, children, tone = "default" }: { title: string; description?: string; children: ReactNode; tone?: "default" | "danger" }) {
  return (
    <section
      aria-labelledby={`settings-${title.toLowerCase().replace(/\W+/g, "-")}`}
      className={`rounded-lg border bg-surface p-5 shadow-sm ${tone === "danger" ? "border-red-200" : "border-slate-200"}`}
    >
      <h2 id={`settings-${title.toLowerCase().replace(/\W+/g, "-")}`} className={`text-base font-semibold ${tone === "danger" ? "text-red-600" : "text-slate-900"}`}>
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function StatusText({ status }: { status: { kind: "ok" | "error"; text: string } | null }) {
  if (!status) return null;
  return (
    <p role={status.kind === "error" ? "alert" : "status"} className={`text-sm ${status.kind === "error" ? "text-red-600" : "text-green-700"}`}>
      {status.text}
    </p>
  );
}
