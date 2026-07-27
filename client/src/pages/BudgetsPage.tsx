import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Field } from "../components/ui/Field";
import { buttonClass, inputClass } from "../components/ui/formStyles";
import { useCategories } from "../features/categories/hooks";
import { useBudgets, useCreateBudget, useDeleteBudget, useUpdateBudget } from "../features/budgets/hooks";
import type { Budget } from "../features/budgets/types";
import { extractErrorMessage } from "../lib/errors";

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

const budgetFormSchema = z.object({
  category: z.string().min(1, "Category is required"),
  limit: z.coerce.number().positive("Limit must be greater than 0"),
});

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

function ProgressBar({ spent, limit, color }: { spent: number; limit: number; color: string }) {
  const percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  const overBudget = spent > limit;

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full"
        style={{ width: `${percent}%`, backgroundColor: overBudget ? "#e34948" : color }}
      />
    </div>
  );
}

function BudgetRow({
  budget,
  onEdit,
  onDelete,
  deleteError,
}: {
  budget: Budget;
  onEdit: (budget: Budget) => void;
  onDelete: (id: string) => void;
  deleteError?: string;
}) {
  const overBudget = budget.spent > budget.limit;

  return (
    <li className="border-b border-slate-100 py-3 last:border-b-0">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium text-slate-800">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: budget.category.color }} />
          {budget.category.name}
        </span>
        <span className={overBudget ? "text-red-600" : "text-slate-600"}>
          {budget.spent.toFixed(2)} / {budget.limit.toFixed(2)}
        </span>
      </div>
      <ProgressBar spent={budget.spent} limit={budget.limit} color={budget.category.color} />
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className={overBudget ? "text-red-600" : "text-slate-400"}>
          {overBudget ? `Over by ${(budget.spent - budget.limit).toFixed(2)}` : `${budget.remaining.toFixed(2)} remaining`}
        </span>
        <span>
          <button type="button" onClick={() => onEdit(budget)} className="mr-2 text-slate-400 hover:text-blue-600">
            Edit
          </button>
          <button type="button" onClick={() => onDelete(budget.id)} className="text-slate-400 hover:text-red-600">
            Delete
          </button>
        </span>
      </div>
      {deleteError && <p className="mt-1 text-xs text-red-600">{deleteError}</p>}
    </li>
  );
}

export function BudgetsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  const { data: categories } = useCategories();
  const { data: budgets, isLoading } = useBudgets(month, year);
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BudgetFormValues>({ resolver: zodResolver(budgetFormSchema) });

  const budgetedCategoryIds = useMemo(() => new Set(budgets?.map((b) => b.category.id)), [budgets]);
  const availableCategories = useMemo(
    () => categories?.filter((c) => c.type === "expense" && !budgetedCategoryIds.has(c.id)) ?? [],
    [categories, budgetedCategoryIds]
  );

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

  async function onSubmit(values: BudgetFormValues): Promise<void> {
    setFormError(null);
    try {
      if (editingId) {
        await updateBudget.mutateAsync({ id: editingId, updates: { limit: values.limit } });
        setEditingId(null);
      } else {
        await createBudget.mutateAsync({ ...values, month, year });
      }
      reset({ category: "", limit: undefined });
    } catch (err) {
      setFormError(extractErrorMessage(err));
    }
  }

  function startEdit(budget: Budget): void {
    setEditingId(budget.id);
    setFormError(null);
    reset({ category: budget.category.id, limit: budget.limit });
  }

  function cancelEdit(): void {
    setEditingId(null);
    setFormError(null);
    reset({ category: "", limit: undefined });
  }

  async function handleDelete(id: string): Promise<void> {
    setDeleteErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      await deleteBudget.mutateAsync(id);
    } catch (err) {
      setDeleteErrors((prev) => ({ ...prev, [id]: extractErrorMessage(err) }));
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Budgets</h1>
        <div className="flex items-center gap-3 text-sm">
          <button type="button" onClick={() => goToMonth(-1)} className="rounded-md border border-slate-300 px-2 py-1">
            Previous
          </button>
          <span className="font-medium text-slate-700">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button type="button" onClick={() => goToMonth(1)} className="rounded-md border border-slate-300 px-2 py-1">
            Next
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : !budgets || budgets.length === 0 ? (
          <p className="text-sm text-slate-500">No budgets set for this month yet.</p>
        ) : (
          <ul>
            {budgets.map((b) => (
              <BudgetRow key={b.id} budget={b} onEdit={startEdit} onDelete={handleDelete} deleteError={deleteErrors[b.id]} />
            ))}
          </ul>
        )}
      </div>

      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
      >
        <h2 className="text-sm font-medium text-slate-700">{editingId ? "Edit budget" : "Add a budget"}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Category" error={errors.category?.message}>
            <select className={inputClass} disabled={!!editingId} {...register("category")}>
              <option value="">Select a category</option>
              {editingId
                ? categories
                    ?.filter((c) => c.type === "expense")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))
                : availableCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
            </select>
          </Field>
          <Field label="Monthly limit" error={errors.limit?.message}>
            <input type="number" step="0.01" className={inputClass} {...register("limit")} />
          </Field>
        </div>
        {formError && <p className="text-sm text-red-600">{formError}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={isSubmitting} className={buttonClass}>
            {isSubmitting ? "Saving..." : editingId ? "Save changes" : "Add budget"}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700">
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
