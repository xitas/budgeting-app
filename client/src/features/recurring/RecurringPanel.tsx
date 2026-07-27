import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { RecurringFrequency } from "shared";
import { z } from "zod";
import { Field } from "../../components/ui/Field";
import { buttonClass, inputClass } from "../../components/ui/formStyles";
import { PencilIcon, PlusIcon, RefreshIcon, TrashIcon } from "../../components/ui/icons";
import { InlineEditActions } from "../../components/ui/InlineEditActions";
import { Modal } from "../../components/ui/Modal";
import { formatDisplayDate } from "../../lib/formatDate";
import { extractErrorMessage } from "../../lib/errors";
import { useCategories } from "../categories/hooks";
import { useCreateRecurring, useDeleteRecurring, useRecurring, useRunRecurringNow, useUpdateRecurring } from "./hooks";
import type { RecurringTransaction, UpdateRecurringInput } from "./types";

const createRecurringSchema = z.object({
  category: z.string().min(1, "Category is required"),
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  description: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  interval: z.coerce.number().int().positive().default(1),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
});

type CreateRecurringFormValues = z.infer<typeof createRecurringSchema>;

function describeFrequency(frequency: RecurringFrequency, interval: number): string {
  const unit = frequency === "daily" ? "day" : frequency === "weekly" ? "week" : "month";
  return interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function AddRecurringForm({ onSuccess }: { onSuccess: () => void }) {
  const { data: categories } = useCategories();
  const createRecurring = useCreateRecurring();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateRecurringFormValues>({
    resolver: zodResolver(createRecurringSchema),
    defaultValues: { type: "expense", frequency: "monthly", interval: 1, startDate: todayIso() },
  });

  async function onSubmit(values: CreateRecurringFormValues): Promise<void> {
    setFormError(null);
    try {
      await createRecurring.mutateAsync({ ...values, endDate: values.endDate || undefined });
      onSuccess();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Type" error={errors.type?.message}>
          <select className={inputClass} {...register("type")}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </Field>
        <Field label="Category" error={errors.category?.message}>
          <select className={inputClass} {...register("category")}>
            <option value="">Select a category</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount" error={errors.amount?.message}>
          <input type="number" step="0.01" className={inputClass} {...register("amount")} />
        </Field>
        <Field label="Frequency" error={errors.frequency?.message}>
          <select className={inputClass} {...register("frequency")}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </Field>
        <Field label="Every (interval)" error={errors.interval?.message}>
          <input type="number" min="1" step="1" className={inputClass} {...register("interval")} />
        </Field>
        <Field label="Start date" error={errors.startDate?.message}>
          <input type="date" className={inputClass} {...register("startDate")} />
        </Field>
        <Field label="End date (optional)" error={errors.endDate?.message}>
          <input type="date" className={inputClass} {...register("endDate")} />
        </Field>
      </div>
      <Field label="Description" error={errors.description?.message}>
        <input type="text" className={inputClass} {...register("description")} />
      </Field>
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <button type="submit" disabled={isSubmitting} className={`${buttonClass} w-full`}>
        {isSubmitting ? "Adding..." : "Add recurring transaction"}
      </button>
    </form>
  );
}

export function RecurringPanel() {
  const { data: recurring, isLoading } = useRecurring();
  const updateRecurring = useUpdateRecurring();
  const deleteRecurring = useDeleteRecurring();
  const runNow = useRunRecurringNow();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<UpdateRecurringInput>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [runMessages, setRunMessages] = useState<Record<string, string>>({});

  function startEdit(r: RecurringTransaction): void {
    setEditingId(r.id);
    setDraft({ amount: r.amount, description: r.description, endDate: r.endDate ?? null, isActive: r.isActive });
    setEditError(null);
  }

  function cancelEdit(): void {
    setEditingId(null);
    setDraft({});
    setEditError(null);
  }

  async function saveEdit(): Promise<void> {
    if (!editingId) return;
    setEditError(null);
    try {
      await updateRecurring.mutateAsync({ id: editingId, updates: draft });
      setEditingId(null);
      setDraft({});
    } catch (err) {
      setEditError(extractErrorMessage(err));
    }
  }

  async function handleDelete(id: string): Promise<void> {
    setRowErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      await deleteRecurring.mutateAsync(id);
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [id]: extractErrorMessage(err) }));
    }
  }

  async function handleRunNow(id: string): Promise<void> {
    setRunMessages((prev) => ({ ...prev, [id]: "" }));
    try {
      const { generated } = await runNow.mutateAsync(id);
      setRunMessages((prev) => ({ ...prev, [id]: generated > 0 ? `Generated ${generated}` : "Already up to date" }));
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [id]: extractErrorMessage(err) }));
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          aria-label="Add recurring transaction"
          title="Add recurring transaction"
          className="rounded-full bg-blue-600 p-2 text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : !recurring || recurring.length === 0 ? (
          <p className="text-sm text-slate-500">No recurring transactions set up yet.</p>
        ) : (
          <ul>
            {recurring.map((r) => {
              const isEditing = r.id === editingId;
              return (
                <li
                  key={r.id}
                  className={`rounded-md border-b border-slate-100 px-2 py-3 transition-colors last:border-b-0 ${
                    isEditing ? "border-l-2 border-l-blue-400 bg-blue-50/50" : ""
                  } ${!r.isActive && !isEditing ? "opacity-50" : ""}`}
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-medium text-slate-800">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.category.color }} />
                      {r.category.name}
                      {!r.isActive && <span className="text-xs font-normal text-slate-400">(paused)</span>}
                    </span>
                    <span className={r.type === "income" ? "text-green-700" : "text-slate-900"}>
                      {r.type === "income" ? "+" : "-"}
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          className={`${inputClass} ml-1 inline w-20 py-1`}
                          value={draft.amount ?? ""}
                          onChange={(e) => setDraft((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                        />
                      ) : (
                        r.amount.toFixed(2)
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {describeFrequency(r.frequency, r.interval)} · started {formatDisplayDate(r.startDate)}
                    {r.endDate && ` · ends ${formatDisplayDate(r.endDate)}`}
                  </p>
                  {isEditing ? (
                    <div className="mt-2 space-y-2">
                      <input
                        type="text"
                        placeholder="Description"
                        className={`${inputClass} py-1`}
                        value={draft.description ?? ""}
                        onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                      />
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={draft.isActive ?? true}
                            onChange={(e) => setDraft((prev) => ({ ...prev, isActive: e.target.checked }))}
                          />
                          Active
                        </label>
                        <InlineEditActions onSave={() => void saveEdit()} onCancel={cancelEdit} isSaving={updateRecurring.isPending} />
                      </div>
                      {editError && <p className="text-xs text-red-600">{editError}</p>}
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="text-slate-400">{r.description || "—"}</span>
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void handleRunNow(r.id)}
                          aria-label="Run now"
                          title="Run now"
                          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600"
                        >
                          <RefreshIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(r)}
                          aria-label="Edit recurring transaction"
                          title="Edit"
                          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(r.id)}
                          aria-label="Delete recurring transaction"
                          title="Delete"
                          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                  )}
                  {runMessages[r.id] && <p className="mt-1 text-xs text-blue-600">{runMessages[r.id]}</p>}
                  {rowErrors[r.id] && <p className="mt-1 text-xs text-red-600">{rowErrors[r.id]}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add a recurring transaction">
        <AddRecurringForm onSuccess={() => setIsAddOpen(false)} />
      </Modal>
    </div>
  );
}
