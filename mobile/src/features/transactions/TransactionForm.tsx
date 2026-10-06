import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { TransactionType } from "shared";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { CategoryPicker } from "../../components/ui/CategoryPicker";
import { DateField } from "../../components/ui/DateField";
import { FormField } from "../../components/ui/FormField";
import { Notice } from "../../components/ui/Notice";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { extractErrorMessage } from "../../lib/errors";
import { amountField, zodFormResolver } from "../../lib/money";
import { useCategories } from "../categories/hooks";

const transactionFormSchema = z.object({
  type: z.enum(["income", "expense"]),
  category: z.string().min(1, "Category is required"),
  amountCents: amountField("Amount"),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
});

// Input: what the form holds (amount as typed text). Values: what it submits
// (amount in cents).
export type TransactionFormInput = z.input<typeof transactionFormSchema>;
export type TransactionFormValues = z.output<typeof transactionFormSchema>;

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

interface TransactionFormProps {
  defaultValues: Partial<TransactionFormInput>;
  submitLabel: string;
  onSubmit: (values: TransactionFormValues) => Promise<void>;
}

export function TransactionForm({ defaultValues, submitLabel, onSubmit }: TransactionFormProps) {
  const { data: categories } = useCategories();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormInput, unknown, TransactionFormValues>({ resolver: zodFormResolver(transactionFormSchema), defaultValues });

  const type = watch("type");
  // Only offer categories of the chosen type (the web form lists all of them).
  const typeCategories = (categories ?? []).filter((c) => c.type === type);

  async function submit(values: TransactionFormValues): Promise<void> {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setFormError(extractErrorMessage(err));
    }
  }

  return (
    <>
      <Controller
        control={control}
        name="type"
        render={({ field }) => (
          <SegmentedControl
            label="Type"
            options={TYPE_OPTIONS}
            value={field.value}
            onChange={(next) => {
              field.onChange(next);
              // A category belongs to one type; switching type clears it.
              setValue("category", "");
            }}
          />
        )}
      />
      <Controller
        control={control}
        name="category"
        render={({ field }) => (
          <CategoryPicker
            label="Category"
            categories={typeCategories}
            value={field.value}
            onChange={field.onChange}
            error={errors.category?.message}
            emptyText={`No ${type} categories yet — add one under More → Categories.`}
          />
        )}
      />
      <FormField control={control} name="amountCents" label="Amount" error={errors.amountCents?.message} keyboardType="decimal-pad" placeholder="0.00" />
      <Controller
        control={control}
        name="date"
        render={({ field }) => <DateField label="Date" value={field.value} onChange={field.onChange} error={errors.date?.message} />}
      />
      <FormField control={control} name="description" label="Description (optional)" error={errors.description?.message} />
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      <Button title={isSubmitting ? "Saving..." : submitLabel} disabled={isSubmitting} onPress={() => void handleSubmit(submit)()} />
    </>
  );
}
