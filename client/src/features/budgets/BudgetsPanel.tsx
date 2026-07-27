import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Field } from "../../components/ui/Field";
import { buttonClass, inputClass } from "../../components/ui/formStyles";
import { InlineEditActions } from "../../components/ui/InlineEditActions";
import { Modal } from "../../components/ui/Modal";
import { extractErrorMessage } from "../../lib/errors";
import { useCategories } from "../categories/hooks";
import { useBudgets, useCreateBudget, useDeleteBudget, useUpdateBudget } from "./hooks";
import type { Budget } from "./types";

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
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${percent}%`, backgroundColor: overBudget ? "#e34948" : color }}
      />
    </div>
  );
}

function AddBudgetForm({
  month,
  year,
  availableCategories,
  onSuccess,
}: {
  month: number;
  year: number;
  availableCategories: { id: string; name: string }[];
  onSuccess: () => void;
}) {
  const createBudget = useCreateBudget();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BudgetFormValues>({ resolver: zodResolver(budgetFormSchema) });

  async function onSubmit(values: BudgetFormValues): Promise<void> {
    setFormError(null);
    try {
      await createBudget.mutateAsync({ ...values, month, year });
      onSuccess();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
      <Field label="Category" error={errors.category?.message}>
        <select className={inputClass} {...register("category")}>
          <option value="">Select a category</option>
          {availableCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Monthly limit" error={errors.limit?.message}>
        <input type="number" step="0.01" className={inputClass} {...register("limit")} />
      </Field>
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <button type="submit" disabled={isSubmitting} className={`${buttonClass} w-full`}>
        {isSubmitting ? "Adding..." : "Add budget"}
      </button>
    </form>
  );
}

export function BudgetsPanel() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLimit, setDraftLimit] = useState<number | "">("");
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  const { data: categories } = useCategories();
  const { data: budgets, isLoading } = useBudgets(month, year);
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();

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

  function startEdit(budget: Budget): void {
    setEditingId(budget.id);
    setDraftLimit(budget.limit);
    setEditError(null);
  }

  function cancelEdit(): void {
    setEditingId(null);
    setDraftLimit("");
    setEditError(null);
  }

  async function saveEdit(): Promise<void> {
    if (!editingId || draftLimit === "") return;
    setEditError(null);
    try {
      await updateBudget.mutateAsync({ id: editingId, updates: { limit: Number(draftLimit) } });
      setEditingId(null);
      setDraftLimit("");
    } catch (err) {
      setEditError(extractErrorMessage(err));
    }
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
    <div>
      <div className="mb-3 flex items-center justify-between gap-2 text-sm">
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

      <div className="mb-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : !budgets || budgets.length === 0 ? (
          <p className="text-sm text-slate-500">No budgets set for this month yet.</p>
        ) : (
          <ul>
            {budgets.map((b) => {
              const isEditing = b.id === editingId;
              const overBudget = b.spent > b.limit;
              return (
                <li
                  key={b.id}
                  className={`rounded-md border-b border-slate-100 px-2 py-3 transition-colors last:border-b-0 ${
                    isEditing ? "border-l-2 border-l-blue-400 bg-blue-50/50" : ""
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-medium text-slate-800">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.category.color }} />
                      {b.category.name}
                    </span>
                    {isEditing ? (
                      <span className="flex items-center gap-1">
                        {b.spent.toFixed(2)} /
                        <input
                          type="number"
                          step="0.01"
                          autoFocus
                          className={`${inputClass} w-24 py-1`}
                          value={draftLimit}
                          onChange={(e) => setDraftLimit(e.target.value === "" ? "" : Number(e.target.value))}
                        />
                      </span>
                    ) : (
                      <span className={overBudget ? "text-red-600" : "text-slate-600"}>
                        {b.spent.toFixed(2)} / {b.limit.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <ProgressBar spent={b.spent} limit={isEditing && draftLimit !== "" ? Number(draftLimit) : b.limit} color={b.category.color} />
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className={overBudget ? "text-red-600" : "text-slate-400"}>
                      {overBudget ? `Over by ${(b.spent - b.limit).toFixed(2)}` : `${b.remaining.toFixed(2)} remaining`}
                    </span>
                    {isEditing ? (
                      <InlineEditActions onSave={() => void saveEdit()} onCancel={cancelEdit} isSaving={updateBudget.isPending} />
                    ) : (
                      <span>
                        <button
                          type="button"
                          onClick={() => startEdit(b)}
                          className="mr-2 text-slate-400 transition-colors hover:text-blue-600"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(b.id)}
                          className="text-slate-400 transition-colors hover:text-red-600"
                        >
                          Delete
                        </button>
                      </span>
                    )}
                  </div>
                  {editError && isEditing && <p className="mt-1 text-xs text-red-600">{editError}</p>}
                  {deleteErrors[b.id] && <p className="mt-1 text-xs text-red-600">{deleteErrors[b.id]}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button type="button" onClick={() => setIsAddOpen(true)} className={`${buttonClass} w-full`}>
        + Add budget
      </button>

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add a budget">
        <AddBudgetForm month={month} year={year} availableCategories={availableCategories} onSuccess={() => setIsAddOpen(false)} />
      </Modal>
    </div>
  );
}
