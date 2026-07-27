import { useState } from "react";
import { BudgetsPanel } from "../features/budgets/BudgetsPanel";
import { CategoriesPanel } from "../features/categories/CategoriesPanel";
import { LoansPanel } from "../features/loans/LoansPanel";
import { RecurringPanel } from "../features/recurring/RecurringPanel";
import { TransactionsPanel } from "../features/transactions/TransactionsPanel";

type RightTab = "budgets" | "categories" | "recurring" | "loans";

const TABS: { key: RightTab; label: string }[] = [
  { key: "budgets", label: "Budgets" },
  { key: "categories", label: "Categories" },
  { key: "recurring", label: "Recurring" },
  { key: "loans", label: "Loans" },
];

export function WorkspacePage() {
  const [rightTab, setRightTab] = useState<RightTab>("budgets");

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-8 lg:flex-row lg:items-start">
      <TransactionsPanel />

      <div className="flex-1 lg:max-w-md">
        <div className="mb-4 inline-flex flex-wrap rounded-full bg-slate-100 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setRightTab(tab.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                rightTab === tab.key ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {rightTab === "budgets" && <BudgetsPanel />}
        {rightTab === "categories" && <CategoriesPanel />}
        {rightTab === "recurring" && <RecurringPanel />}
        {rightTab === "loans" && <LoansPanel />}
      </div>
    </div>
  );
}
