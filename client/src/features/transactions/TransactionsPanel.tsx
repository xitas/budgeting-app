import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Field } from "../../components/ui/Field";
import { buttonClass, ghostButtonClass, inputClass } from "../../components/ui/formStyles";
import { PencilIcon, PlusIcon, TrashIcon } from "../../components/ui/icons";
import { InlineEditActions } from "../../components/ui/InlineEditActions";
import { Modal } from "../../components/ui/Modal";
import { extractErrorMessage } from "../../lib/errors";
import { formatDisplayDate } from "../../lib/formatDate";
import { useCategories } from "../categories/hooks";
import { useCreateTransaction, useDeleteTransaction, useTransactions, useUpdateTransaction } from "./hooks";
import type { Transaction, TransactionFilters, UpdateTransactionInput } from "./types";

const transactionFormSchema = z.object({
  category: z.string().min(1, "Category is required"),
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

const PAGE_SIZE = 20;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function AddTransactionForm({ onSuccess }: { onSuccess: () => void }) {
  const { data: categories } = useCategories();
  const createTransaction = useCreateTransaction();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: { type: "expense", date: todayIso(), amount: undefined },
  });

  async function onSubmit(values: TransactionFormValues): Promise<void> {
    setFormError(null);
    try {
      await createTransaction.mutateAsync(values);
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
        <Field label="Date" error={errors.date?.message}>
          <input type="date" className={inputClass} {...register("date")} />
        </Field>
      </div>
      <Field label="Description" error={errors.description?.message}>
        <input type="text" className={inputClass} {...register("description")} />
      </Field>
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <button type="submit" disabled={isSubmitting} className={`${buttonClass} w-full`}>
        {isSubmitting ? "Adding..." : "Add transaction"}
      </button>
    </form>
  );
}

export function TransactionsPanel() {
  const [filters, setFilters] = useState<TransactionFilters>({ page: 1, limit: PAGE_SIZE });
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<UpdateTransactionInput>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  const { data: categories } = useCategories();
  const { data, isLoading, isError } = useTransactions(filters);
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();

  function startEdit(tx: Transaction): void {
    setEditingId(tx.id);
    setEditError(null);
    setDraft({
      category: tx.category.id,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      date: tx.date.slice(0, 10),
    });
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
      await updateTransaction.mutateAsync({ id: editingId, updates: draft });
      setEditingId(null);
      setDraft({});
    } catch (err) {
      setEditError(extractErrorMessage(err));
    }
  }

  async function handleDelete(id: string): Promise<void> {
    setDeleteErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      await deleteTransaction.mutateAsync(id);
    } catch (err) {
      setDeleteErrors((prev) => ({ ...prev, [id]: extractErrorMessage(err) }));
    }
  }

  return (
    <div className="flex-1 lg:flex-[2]">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Transactions</h1>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Type</span>
          <select
            aria-label="Filter by type"
            className={inputClass}
            value={filters.type ?? ""}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, page: 1, type: (e.target.value || undefined) as TransactionFilters["type"] }))
            }
          >
            <option value="">All</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Category</span>
          <select
            aria-label="Filter by category"
            className={inputClass}
            value={filters.category ?? ""}
            onChange={(e) => setFilters((prev) => ({ ...prev, page: 1, category: e.target.value || undefined }))}
          >
            <option value="">All</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">From</span>
          <input
            type="date"
            className={inputClass}
            value={filters.from ?? ""}
            onChange={(e) => setFilters((prev) => ({ ...prev, page: 1, from: e.target.value || undefined }))}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">To</span>
          <input
            type="date"
            className={inputClass}
            value={filters.to ?? ""}
            onChange={(e) => setFilters((prev) => ({ ...prev, page: 1, to: e.target.value || undefined }))}
          />
        </label>
      </div>

      <div className="mb-4 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
              <th className="px-4 py-2 text-right">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(true)}
                  aria-label="Add transaction"
                  title="Add transaction"
                  className="rounded-full bg-blue-600 p-1.5 text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-4 text-sm text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={5} className="p-4 text-sm text-red-600">
                  Couldn&apos;t load transactions. Try refreshing the page.
                </td>
              </tr>
            ) : !data || data.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-sm text-slate-500">
                  No transactions found.
                </td>
              </tr>
            ) : (
              data.items.map((tx) => {
                const isEditing = tx.id === editingId;
                return (
                  <tr
                    key={tx.id}
                    className={`border-b border-slate-100 transition-colors last:border-b-0 ${
                      isEditing ? "border-l-2 border-l-blue-400 bg-blue-50/50" : "hover:bg-slate-50"
                    }`}
                  >
                    {isEditing ? (
                      <>
                        <td className="px-4 py-2">
                          <input
                            type="date"
                            className={inputClass}
                            value={draft.date ?? ""}
                            onChange={(e) => setDraft((prev) => ({ ...prev, date: e.target.value }))}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select
                            className={inputClass}
                            value={draft.category ?? ""}
                            onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))}
                          >
                            {categories?.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            className={inputClass}
                            value={draft.description ?? ""}
                            onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            className={inputClass}
                            value={draft.amount ?? ""}
                            onChange={(e) => setDraft((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <InlineEditActions onSave={() => void saveEdit()} onCancel={cancelEdit} isSaving={updateTransaction.isPending} />
                          {editError && <div className="mt-1 text-xs text-red-600">{editError}</div>}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2 text-slate-600">{formatDisplayDate(tx.date)}</td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tx.category.color }} />
                            {tx.category.name}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-600">{tx.description || "—"}</td>
                        <td className={`px-4 py-2 text-right ${tx.type === "income" ? "text-green-700" : "text-slate-900"}`}>
                          {tx.type === "income" ? "+" : "-"}
                          {tx.amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(tx)}
                              aria-label="Edit transaction"
                              title="Edit"
                              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(tx.id)}
                              aria-label="Delete transaction"
                              title="Delete"
                              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </span>
                          {deleteErrors[tx.id] && <div className="text-xs text-red-600">{deleteErrors[tx.id]}</div>}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={data.page <= 1}
            onClick={() => setFilters((prev) => ({ ...prev, page: data.page - 1 }))}
            className={`${ghostButtonClass} px-2 py-1 disabled:opacity-40`}
          >
            Previous
          </button>
          <span className="text-slate-500">
            Page {data.page} of {data.totalPages}
          </span>
          <button
            type="button"
            disabled={data.page >= data.totalPages}
            onClick={() => setFilters((prev) => ({ ...prev, page: data.page + 1 }))}
            className={`${ghostButtonClass} px-2 py-1 disabled:opacity-40`}
          >
            Next
          </button>
        </div>
      )}

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add a transaction">
        <AddTransactionForm onSuccess={() => setIsAddOpen(false)} />
      </Modal>
    </div>
  );
}
