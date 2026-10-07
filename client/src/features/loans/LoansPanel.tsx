import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Field } from "../../components/ui/Field";
import { buttonClass, inputClass } from "../../components/ui/formStyles";
import { PencilIcon, PlusIcon, TrashIcon } from "../../components/ui/icons";
import { InlineEditActions } from "../../components/ui/InlineEditActions";
import { Modal } from "../../components/ui/Modal";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { formatDisplayDate } from "../../lib/formatDate";
import { extractErrorMessage } from "../../lib/errors";
import { zodFormResolver } from "../../lib/zodFormResolver";
import { amountField, parseAmountDraft } from "../../lib/money";
import { useAddRepayment, useCreateLoan, useDeleteLoan, useLoans, useRemoveRepayment, useUpdateLoan } from "./hooks";
import { CATEGORICAL_PALETTE, centsToDecimalString, parseAmountInput, type Loan, type UpdateLoanInput } from "shared";
import { useSchemeColor } from "../../context/ThemeContext";
import { useMoney, type Money } from "../../lib/useMoney";

const createLoanSchema = z.object({
  counterparty: z.string().min(1, "Counterparty is required"),
  direction: z.enum(["lent", "borrowed"]),
  principalCents: amountField("Principal"),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
});
type CreateLoanFormInput = z.input<typeof createLoanSchema>;
type CreateLoanFormValues = z.output<typeof createLoanSchema>;

const addRepaymentSchema = z.object({
  amountCents: amountField("Amount"),
  date: z.string().min(1, "Date is required"),
  note: z.string().optional(),
});
type AddRepaymentFormInput = z.input<typeof addRepaymentSchema>;
type AddRepaymentFormValues = z.output<typeof addRepaymentSchema>;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function describeLoanState(loan: Loan, money: Money): string {
  if (loan.status === "written_off") {
    return loan.direction === "lent" ? "Written off" : "Forgiven";
  }
  if (loan.outstandingCents < 0) {
    return `Overpaid by ${money.format(loan.outstandingCents, { sign: "never" })}`;
  }
  if (loan.outstandingCents === 0) {
    return "Settled";
  }
  return `${money.format(loan.outstandingCents)} remaining`;
}

function AddLoanForm({ onSuccess }: { onSuccess: () => void }) {
  const createLoan = useCreateLoan();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateLoanFormInput, unknown, CreateLoanFormValues>({
    resolver: zodFormResolver(createLoanSchema),
    defaultValues: { direction: "lent", date: todayIso() },
  });

  async function onSubmit(values: CreateLoanFormValues): Promise<void> {
    setFormError(null);
    try {
      await createLoan.mutateAsync(values);
      onSuccess();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Counterparty" error={errors.counterparty?.message}>
          <input type="text" placeholder="Who?" className={inputClass} {...register("counterparty")} />
        </Field>
        <Field label="Direction" error={errors.direction?.message}>
          <select className={inputClass} {...register("direction")}>
            <option value="lent">I lent money</option>
            <option value="borrowed">I borrowed money</option>
          </select>
        </Field>
        <Field label="Principal" error={errors.principalCents?.message}>
          <input type="text" inputMode="decimal" className={inputClass} {...register("principalCents")} />
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
        {isSubmitting ? "Adding..." : "Add loan"}
      </button>
    </form>
  );
}

function AddRepaymentForm({ loanId, onSuccess }: { loanId: string; onSuccess: () => void }) {
  const addRepayment = useAddRepayment();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddRepaymentFormInput, unknown, AddRepaymentFormValues>({
    resolver: zodFormResolver(addRepaymentSchema),
    defaultValues: { date: todayIso() },
  });

  async function onSubmit(values: AddRepaymentFormValues): Promise<void> {
    setFormError(null);
    try {
      await addRepayment.mutateAsync({ id: loanId, input: values });
      onSuccess();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Amount" error={errors.amountCents?.message}>
          <input type="text" inputMode="decimal" className={inputClass} {...register("amountCents")} />
        </Field>
        <Field label="Date" error={errors.date?.message}>
          <input type="date" className={inputClass} {...register("date")} />
        </Field>
      </div>
      <Field label="Note (optional)" error={errors.note?.message}>
        <input type="text" className={inputClass} {...register("note")} />
      </Field>
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <button type="submit" disabled={isSubmitting} className={`${buttonClass} w-full`}>
        {isSubmitting ? "Adding..." : "Add repayment"}
      </button>
    </form>
  );
}

export function LoansPanel() {
  const money = useMoney();
  const schemeColor = useSchemeColor();
  const { data: loans, isLoading, isError } = useLoans();
  const updateLoan = useUpdateLoan();
  const deleteLoan = useDeleteLoan();
  const removeRepayment = useRemoveRepayment();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [repaymentModalLoanId, setRepaymentModalLoanId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<UpdateLoanInput>({});
  const [draftPrincipal, setDraftPrincipal] = useState(""); // the typed text
  const [editError, setEditError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  function toggleExpanded(id: string): void {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function startEdit(loan: Loan): void {
    setEditingId(loan.id);
    setDraft({
      counterparty: loan.counterparty,
      description: loan.description,
      date: loan.date.slice(0, 10),
      writtenOff: loan.writtenOff,
    });
    setDraftPrincipal(centsToDecimalString(loan.principalCents));
    setEditError(null);
  }

  function cancelEdit(): void {
    setEditingId(null);
    setDraft({});
    setEditError(null);
  }

  async function saveEdit(): Promise<void> {
    if (!editingId) return;
    const principal = parseAmountDraft("Principal", draftPrincipal);
    if ("error" in principal) {
      setEditError(principal.error);
      return;
    }
    setEditError(null);
    try {
      await updateLoan.mutateAsync({ id: editingId, updates: { ...draft, principalCents: principal.cents } });
      setEditingId(null);
      setDraft({});
    } catch (err) {
      setEditError(extractErrorMessage(err));
    }
  }

  async function handleDelete(id: string): Promise<void> {
    setRowErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      await deleteLoan.mutateAsync(id);
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [id]: extractErrorMessage(err) }));
    }
  }

  async function handleRemoveRepayment(loanId: string, repaymentId: string): Promise<void> {
    setRowErrors((prev) => ({ ...prev, [repaymentId]: "" }));
    try {
      await removeRepayment.mutateAsync({ id: loanId, repaymentId });
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [repaymentId]: extractErrorMessage(err) }));
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          aria-label="Add loan"
          title="Add loan"
          className="rounded-full bg-blue-600 p-2 text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-surface p-4 shadow-sm">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : isError ? (
          <p className="text-sm text-red-600">Couldn&apos;t load loans. Try refreshing the page.</p>
        ) : !loans || loans.length === 0 ? (
          <p className="text-sm text-slate-500">No loans tracked yet.</p>
        ) : (
          <ul>
            {loans.map((loan) => {
              const isEditing = loan.id === editingId;
              const isExpanded = expandedIds.has(loan.id);

              return (
                <li
                  key={loan.id}
                  className={`rounded-md border-b border-slate-100 px-2 py-3 transition-colors last:border-b-0 ${
                    isEditing ? "border-l-2 border-l-blue-400 bg-blue-50/50" : ""
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-medium text-slate-800">
                      {isEditing ? (
                        <input
                          type="text"
                          className={`${inputClass} py-1`}
                          value={draft.counterparty ?? ""}
                          onChange={(e) => setDraft((prev) => ({ ...prev, counterparty: e.target.value }))}
                        />
                      ) : (
                        <>
                          {loan.counterparty}
                          <span className="text-xs font-normal text-slate-400">
                            {loan.direction === "lent" ? "(lent)" : "(borrowed)"}
                          </span>
                        </>
                      )}
                    </span>
                    <span className={loan.outstandingCents < 0 ? "text-red-600" : "text-slate-900"}>
                      {money.format(loan.repaidCents)} /{" "}
                      {isEditing ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label="Principal"
                          className={`${inputClass} ml-1 inline w-24 py-1`}
                          value={draftPrincipal}
                          onChange={(e) => setDraftPrincipal(e.target.value)}
                        />
                      ) : (
                        money.format(loan.principalCents)
                      )}
                    </span>
                  </div>

                  <ProgressBar value={loan.repaidCents} max={isEditing ? (parseAmountInput(draftPrincipal) ?? loan.principalCents) : loan.principalCents} color={schemeColor(loan.direction === "lent" ? CATEGORICAL_PALETTE[2] : CATEGORICAL_PALETTE[1])} />

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
                            checked={draft.writtenOff ?? false}
                            onChange={(e) => setDraft((prev) => ({ ...prev, writtenOff: e.target.checked }))}
                          />
                          {loan.direction === "lent" ? "Write off" : "Forgiven"}
                        </label>
                        <InlineEditActions onSave={() => void saveEdit()} onCancel={cancelEdit} isSaving={updateLoan.isPending} />
                      </div>
                      {editError && <p className="text-xs text-red-600">{editError}</p>}
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        {describeLoanState(loan, money)} · {formatDisplayDate(loan.date)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(loan.id)}
                          aria-label={isExpanded ? "Hide repayment history" : "Show repayment history"}
                          title={isExpanded ? "Hide repayment history" : "Show repayment history"}
                          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-link"
                        >
                          {isExpanded ? "▾" : "▸"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRepaymentModalLoanId(loan.id)}
                          aria-label="Add repayment"
                          title="Add repayment"
                          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-link"
                        >
                          <PlusIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(loan)}
                          aria-label="Edit loan"
                          title="Edit"
                          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-link"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(loan.id)}
                          aria-label="Delete loan"
                          title="Delete"
                          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                  )}
                  {rowErrors[loan.id] && <p className="mt-1 text-xs text-red-600">{rowErrors[loan.id]}</p>}

                  {isExpanded && !isEditing && (
                    <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
                      {loan.repayments.length === 0 ? (
                        <li className="text-xs text-slate-400">No repayments yet.</li>
                      ) : (
                        loan.repayments.map((r) => (
                          <li key={r.id}>
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>
                                {formatDisplayDate(r.date)} — {money.format(r.amountCents)}
                                {r.note && ` (${r.note})`}
                              </span>
                              <button
                                type="button"
                                onClick={() => void handleRemoveRepayment(loan.id, r.id)}
                                aria-label="Delete repayment"
                                title="Delete repayment"
                                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              >
                                <TrashIcon className="h-3 w-3" />
                              </button>
                            </div>
                            {rowErrors[r.id] && <p className="text-xs text-red-600">{rowErrors[r.id]}</p>}
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add a loan">
        <AddLoanForm onSuccess={() => setIsAddOpen(false)} />
      </Modal>

      <Modal isOpen={repaymentModalLoanId !== null} onClose={() => setRepaymentModalLoanId(null)} title="Add a repayment">
        {repaymentModalLoanId && (
          <AddRepaymentForm loanId={repaymentModalLoanId} onSuccess={() => setRepaymentModalLoanId(null)} />
        )}
      </Modal>
    </div>
  );
}
