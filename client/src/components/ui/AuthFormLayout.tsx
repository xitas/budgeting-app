import type { ReactNode } from "react";
import { ThemeToggle } from "../ThemeToggle";

export function AuthFormLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-surface p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold text-slate-900">{title}</h1>
        {children}
      </div>
    </div>
  );
}
