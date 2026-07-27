import { useState } from "react";
import { BudgetVsActualChart } from "../components/charts/BudgetVsActualChart";
import { IncomeVsExpenseChart } from "../components/charts/IncomeVsExpenseChart";
import { SpendingByCategoryChart } from "../components/charts/SpendingByCategoryChart";
import { StatTile } from "../components/charts/StatTile";
import { useAuth } from "../context/AuthContext";
import { useBudgetVsActual, useDashboardSummary, useIncomeVsExpense, useSpendingByCategory } from "../features/dashboard/hooks";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function DashboardPage() {
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: summary } = useDashboardSummary(month, year);
  const { data: spending } = useSpendingByCategory(month, year);
  const { data: trend } = useIncomeVsExpense(month, year, 6);
  const { data: budgets } = useBudgetVsActual(month, year);

  function goToMonth(delta: number): void {
    let nextMonth = month + delta;
    let nextYear = year;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    } else if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    }
    setMonth(nextMonth);
    setYear(nextYear);
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Welcome, {user?.name}</h1>
          <p className="mt-1 text-sm text-slate-500">{user?.email}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button type="button" onClick={() => goToMonth(-1)} className="rounded-md px-2 py-1 text-slate-500 transition-colors hover:bg-slate-100">
            ‹
          </button>
          <span className="font-medium text-slate-700">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button type="button" onClick={() => goToMonth(1)} className="rounded-md px-2 py-1 text-slate-500 transition-colors hover:bg-slate-100">
            ›
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Income" value={(summary?.income ?? 0).toFixed(2)} tone="positive" />
        <StatTile label="Expense" value={(summary?.expense ?? 0).toFixed(2)} tone="negative" />
        <StatTile
          label="Net"
          value={(summary?.net ?? 0).toFixed(2)}
          tone={summary && summary.net < 0 ? "negative" : "neutral"}
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SpendingByCategoryChart data={spending ?? []} />
        <BudgetVsActualChart data={budgets ?? []} />
      </div>

      <IncomeVsExpenseChart data={trend ?? []} />
    </div>
  );
}
