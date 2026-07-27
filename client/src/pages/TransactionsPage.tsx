import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Field } from "../components/ui/Field";
import { buttonClass, inputClass } from "../components/ui/formStyles";
import { useCategories } from "../features/categories/hooks";
import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
} from "../features/transactions/hooks";
import type { Transaction, TransactionFilters } from "../features/transactions/types";
import { extractErrorMessage } from "../lib/errors";

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

export function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionFilters>({ page: 1, limit: PAGE_SIZE });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  const { data: categories } = useCategories();
  const { data, isLoading } = useTransactions(filters);
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: { type: "expense", date: todayIso(), amount: undefined },
  });

  async function onSubmit(values: TransactionFormValues): Promise<void> {
    setFormError(null);
    try {
      if (editingId) {
        await updateTransaction.mutateAsync({ id: editingId, updates: values });
        setEditingId(null);
      } else {
        await createTransaction.mutateAsync(values);
      }
      reset({ type: values.type, date: todayIso(), category: "", amount: undefined, description: "" });
    } catch (err) {
      setFormError(extractErrorMessage(err));
    }
  }

  function startEdit(tx: Transaction): void {
    setEditingId(tx.id);
    setFormError(null);
    reset({
      category: tx.category.id,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      date: tx.date.slice(0, 10),
    });
  }

  function cancelEdit(): void {
    setEditingId(null);
    setFormError(null);
    reset({ type: "expense", date: todayIso(), category: "", amount: undefined, description: "" });
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
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Transactions</h1>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
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

      <div className="mb-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        {isLoading ? (
          <p className="p-4 text-sm text-slate-500">Loading...</p>
        ) : !data || data.items.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No transactions found.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((tx) => (
                <tr key={tx.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-4 py-2 text-slate-600">{tx.date.slice(0, 10)}</td>
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
                    <button type="button" onClick={() => startEdit(tx)} className="mr-2 text-xs text-slate-500 hover:text-blue-600">
                      Edit
                    </button>
                    <button type="button" onClick={() => void handleDelete(tx.id)} className="text-xs text-slate-500 hover:text-red-600">
                      Delete
                    </button>
                    {deleteErrors[tx.id] && <div className="text-xs text-red-600">{deleteErrors[tx.id]}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="mb-6 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={data.page <= 1}
            onClick={() => setFilters((prev) => ({ ...prev, page: data.page - 1 }))}
            className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40"
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
            className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
      >
        <h2 className="text-sm font-medium text-slate-700">{editingId ? "Edit transaction" : "Add a transaction"}</h2>
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
        <div className="flex gap-2">
          <button type="submit" disabled={isSubmitting} className={buttonClass}>
            {isSubmitting ? "Saving..." : editingId ? "Save changes" : "Add transaction"}
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
