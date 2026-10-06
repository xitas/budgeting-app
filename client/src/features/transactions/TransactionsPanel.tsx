import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Field } from "../../components/ui/Field";
import { buttonClass, ghostButtonClass, inputClass } from "../../components/ui/formStyles";
import { PencilIcon, PlusIcon, TrashIcon } from "../../components/ui/icons";
import { InlineEditActions } from "../../components/ui/InlineEditActions";
import { Modal } from "../../components/ui/Modal";
import { extractErrorMessage } from "../../lib/errors";
import { downloadBlob } from "../../lib/download";
import { formatDisplayDate } from "../../lib/formatDate";
import { amountField, parseAmountDraft } from "../../lib/money";
import { zodFormResolver } from "../../lib/zodFormResolver";
import { exportTransactionsCsv } from "./api";
import { useCategories } from "../categories/hooks";
import { useCreateTransaction, useDeleteTransaction, useTransactions, useUpdateTransaction } from "./hooks";
import { centsToDecimalString, formatSignedAmount, type Transaction, type TransactionFilters } from "shared";
import { useSchemeColor } from "../../context/ThemeContext";

const transactionFormSchema = z.object({
  category: z.string().min(1, "Category is required"),
  type: z.enum(["income", "expense"]),
  amountCents: amountField("Amount"),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
});

type TransactionFormInput = z.input<typeof transactionFormSchema>;
type TransactionFormValues = z.output<typeof transactionFormSchema>;

// Inline edit state: the amount stays as the typed text until saved.
interface TransactionDraft {
  category: string;
  description: string;
  date: string;
  amount: string;
}

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
  } = useForm<TransactionFormInput, unknown, TransactionFormValues>({
    resolver: zodFormResolver(transactionFormSchema),
    defaultValues: { type: "expense", date: todayIso() },
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
        <Field label="Amount" error={errors.amountCents?.message}>
          <input type="text" inputMode="decimal" placeholder="0.00" className={inputClass} {...register("amountCents")} />
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

function AddTransactionButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add transaction"
      title="Add transaction"
      className="rounded-full bg-blue-600 p-1.5 text-white shadow-sm transition-colors hover:bg-blue-700"
    >
      <PlusIcon className="h-3.5 w-3.5" />
    </button>
  );
}

// Edit/delete, identical in the table and the phone card list. Loan-linked
// transactions are managed from the Loans tab, so both stay disabled there.
function RowActions({ tx, onEdit, onDelete, error }: { tx: Transaction; onEdit: () => void; onDelete: () => void; error?: string }) {
  const managedByLoan = tx.source === "loan";
  return (
    <>
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          disabled={managedByLoan}
          aria-label="Edit transaction"
          title={managedByLoan ? "Managed in the Loans tab" : "Edit"}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-link disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
        >
          <PencilIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={managedByLoan}
          aria-label="Delete transaction"
          title={managedByLoan ? "Managed in the Loans tab" : "Delete"}
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </span>
      {error && <div className="text-xs text-red-600">{error}</div>}
    </>
  );
}

function amountClass(tx: Transaction): string {
  return tx.type === "income" ? "text-green-700" : "text-slate-900";
}

export function TransactionsPanel() {
  const schemeColor = useSchemeColor();
  const [filters, setFilters] = useState<TransactionFilters>({ page: 1, limit: PAGE_SIZE });
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TransactionDraft>({ category: "", description: "", date: "", amount: "" });
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data: categories } = useCategories();
  const { data, isLoading, isError } = useTransactions(filters);
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();

  function startEdit(tx: Transaction): void {
    setEditingId(tx.id);
    setEditError(null);
    setDraft({
      category: tx.category.id,
      description: tx.description,
      date: tx.date.slice(0, 10),
      amount: centsToDecimalString(tx.amountCents),
    });
  }

  function cancelEdit(): void {
    setEditingId(null);
    setEditError(null);
  }

  async function saveEdit(): Promise<void> {
    if (!editingId) return;
    const amount = parseAmountDraft("Amount", draft.amount);
    if ("error" in amount) {
      setEditError(amount.error);
      return;
    }
    setEditError(null);
    try {
      await updateTransaction.mutateAsync({
        id: editingId,
        updates: { category: draft.category, description: draft.description, date: draft.date, amountCents: amount.cents },
      });
      setEditingId(null);
    } catch (err) {
      setEditError(extractErrorMessage(err));
    }
  }

  async function handleExport(): Promise<void> {
    setIsExporting(true);
    setExportError(null);
    try {
      const blob = await exportTransactionsCsv(filters);
      downloadBlob(blob, `transactions-${todayIso()}.csv`);
    } catch (err) {
      setExportError(extractErrorMessage(err));
    } finally {
      setIsExporting(false);
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

  // The inline-edit inputs, placed by the table (one per cell) or the phone
  // card (stacked) — same state and handlers either way.
  const draftInputs = {
    date: (
      <input
        type="date"
        aria-label="Date"
        className={inputClass}
        value={draft.date}
        onChange={(e) => setDraft((prev) => ({ ...prev, date: e.target.value }))}
      />
    ),
    category: (
      <select
        aria-label="Category"
        className={inputClass}
        value={draft.category}
        onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))}
      >
        {categories?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    ),
    description: (
      <input
        type="text"
        aria-label="Description"
        className={inputClass}
        value={draft.description}
        onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
      />
    ),
    amount: (
      <input
        type="text"
        inputMode="decimal"
        aria-label="Amount"
        className={inputClass}
        value={draft.amount}
        onChange={(e) => setDraft((prev) => ({ ...prev, amount: e.target.value }))}
      />
    ),
  };
  const editActions = (
    <>
      <InlineEditActions onSave={() => void saveEdit()} onCancel={cancelEdit} isSaving={updateTransaction.isPending} />
      {editError && <div className="mt-1 text-xs text-red-600">{editError}</div>}
    </>
  );

  const statusMessage = isLoading ? (
    <p className="p-4 text-sm text-slate-500">Loading...</p>
  ) : isError ? (
    <p className="p-4 text-sm text-red-600">Couldn&apos;t load transactions. Try refreshing the page.</p>
  ) : !data || data.items.length === 0 ? (
    <p className="p-4 text-sm text-slate-500">No transactions found.</p>
  ) : null;
  const items = statusMessage ? [] : (data?.items ?? []);

  return (
    <div className="min-w-0 flex-1 lg:flex-[2]">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Transactions</h1>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-surface p-4 shadow-sm">
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
        <div className="ml-auto flex flex-col items-end">
          <div className="flex gap-2">
            <Link to="/import" className={ghostButtonClass} title="Add transactions from a bank or app CSV file">
              Import CSV
            </Link>
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={isExporting}
              title="Download the transactions matching these filters as a CSV file"
              className={ghostButtonClass}
            >
              {isExporting ? "Exporting..." : "Export CSV"}
            </button>
          </div>
          {exportError && <span className="mt-1 text-xs text-red-600">{exportError}</span>}
        </div>
      </div>

      {/* Phones: a card per transaction, so the amount and actions never sit
          off-screen behind a sideways scroll. */}
      <div className="mb-4 rounded-lg border border-slate-200 bg-surface shadow-sm sm:hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-sm text-slate-500">
          <span>{data ? `${data.total} transaction${data.total === 1 ? "" : "s"}` : "Transactions"}</span>
          <AddTransactionButton onClick={() => setIsAddOpen(true)} />
        </div>
        {statusMessage}
        <ul>
          {items.map((tx) =>
            tx.id === editingId ? (
              <li key={tx.id} className="space-y-2 border-b border-l-2 border-slate-100 border-l-blue-400 bg-blue-50/50 p-4 last:border-b-0">
                <div className="grid grid-cols-2 gap-2">
                  {draftInputs.date}
                  {draftInputs.amount}
                </div>
                {draftInputs.category}
                {draftInputs.description}
                <div className="flex items-center justify-end">{editActions}</div>
              </li>
            ) : (
              <li key={tx.id} className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: schemeColor(tx.category.color) }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium text-slate-900">{tx.description || tx.category.name}</span>
                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${amountClass(tx)}`}>
                      {formatSignedAmount(tx.amountCents, tx.type)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-xs text-slate-500">
                      {tx.category.name} · {formatDisplayDate(tx.date)}
                    </span>
                    <div className="-mr-1.5 shrink-0 text-right">
                      <RowActions tx={tx} onEdit={() => startEdit(tx)} onDelete={() => void handleDelete(tx.id)} error={deleteErrors[tx.id]} />
                    </div>
                  </div>
                </div>
              </li>
            )
          )}
        </ul>
      </div>

      {/* Wider screens: the table. */}
      <div className="mb-4 hidden overflow-x-auto rounded-lg border border-slate-200 bg-surface shadow-sm sm:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
              <th className="px-4 py-2 text-right">
                <AddTransactionButton onClick={() => setIsAddOpen(true)} />
              </th>
            </tr>
          </thead>
          <tbody>
            {statusMessage ? (
              <tr>
                <td colSpan={5}>{statusMessage}</td>
              </tr>
            ) : (
              items.map((tx) => {
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
                        <td className="px-4 py-2">{draftInputs.date}</td>
                        <td className="px-4 py-2">{draftInputs.category}</td>
                        <td className="px-4 py-2">{draftInputs.description}</td>
                        <td className="px-4 py-2 text-right">{draftInputs.amount}</td>
                        <td className="px-4 py-2 text-right">{editActions}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2 text-slate-600">{formatDisplayDate(tx.date)}</td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: schemeColor(tx.category.color) }} />
                            {tx.category.name}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-600">{tx.description || "—"}</td>
                        <td className={`px-4 py-2 text-right ${amountClass(tx)}`}>{formatSignedAmount(tx.amountCents, tx.type)}</td>
                        <td className="px-4 py-2 text-right">
                          <RowActions tx={tx} onEdit={() => startEdit(tx)} onDelete={() => void handleDelete(tx.id)} error={deleteErrors[tx.id]} />
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
