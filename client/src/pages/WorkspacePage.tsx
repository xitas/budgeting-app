import { useState } from "react";
import { BudgetsPanel } from "../features/budgets/BudgetsPanel";
import { CategoriesPanel } from "../features/categories/CategoriesPanel";
import { TransactionsPanel } from "../features/transactions/TransactionsPanel";

type RightTab = "budgets" | "categories";

export function WorkspacePage() {
  const [rightTab, setRightTab] = useState<RightTab>("budgets");

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-8 lg:flex-row lg:items-start">
      <TransactionsPanel />

      <div className="flex-1 lg:max-w-md">
        <div className="mb-4 inline-flex rounded-full bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setRightTab("budgets")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              rightTab === "budgets" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Budgets
          </button>
          <button
            type="button"
            onClick={() => setRightTab("categories")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              rightTab === "categories" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Categories
          </button>
        </div>

        {rightTab === "budgets" ? <BudgetsPanel /> : <CategoriesPanel />}
      </div>
    </div>
  );
}
