import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { RecurringFrequency, TransactionType } from "shared";
import { z } from "zod";
import { Button } from "../../../components/ui/Button";
import { CategoryPicker } from "../../../components/ui/CategoryPicker";
import { DateField } from "../../../components/ui/DateField";
import { FormField } from "../../../components/ui/FormField";
import { FormScreen } from "../../../components/ui/layout";
import { Notice } from "../../../components/ui/Notice";
import { SegmentedControl } from "../../../components/ui/SegmentedControl";
import { useCategories } from "../../../features/categories/hooks";
import { useCreateRecurring } from "../../../features/recurring/hooks";
import { todayIso } from "../../../lib/dates";
import { extractErrorMessage } from "../../../lib/errors";

const createRecurringSchema = z.object({
  type: z.enum(["income", "expense"]),
  category: z.string().min(1, "Category is required"),
  amount: z.coerce.number({ invalid_type_error: "Enter an amount" }).positive("Amount must be greater than 0"),
  description: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  interval: z.coerce.number({ invalid_type_error: "Enter a whole number" }).int("Enter a whole number").positive("Must be at least 1"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
});
type CreateRecurringFormValues = z.infer<typeof createRecurringSchema>;

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export default function NewRecurringScreen() {
  const { data: categories } = useCategories();
  const createRecurring = useCreateRecurring();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateRecurringFormValues>({
    resolver: zodResolver(createRecurringSchema),
    defaultValues: { type: "expense", frequency: "monthly", interval: 1, startDate: todayIso() },
  });
  const type = watch("type");

  async function onSubmit(values: CreateRecurringFormValues): Promise<void> {
    setFormError(null);
    try {
      await createRecurring.mutateAsync({ ...values, endDate: values.endDate || undefined });
      router.back();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    }
  }

  return (
    <FormScreen>
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
            categories={(categories ?? []).filter((c) => c.type === type)}
            value={field.value}
            onChange={field.onChange}
            error={errors.category?.message}
          />
        )}
      />
      <FormField control={control} name="amount" label="Amount" keyboardType="decimal-pad" placeholder="0.00" error={errors.amount?.message} />
      <Controller
        control={control}
        name="frequency"
        render={({ field }) => (
          <SegmentedControl label="Frequency" options={FREQUENCY_OPTIONS} value={field.value} onChange={field.onChange} />
        )}
      />
      <FormField control={control} name="interval" label="Repeat every (interval)" keyboardType="number-pad" error={errors.interval?.message} />
      <Controller
        control={control}
        name="startDate"
        render={({ field }) => (
          <DateField label="Start date" value={field.value} onChange={field.onChange} error={errors.startDate?.message} />
        )}
      />
      <Controller
        control={control}
        name="endDate"
        render={({ field }) => (
          <DateField
            label="End date (optional)"
            value={field.value || undefined}
            onChange={field.onChange}
            onClear={() => field.onChange("")}
            placeholder="No end date"
          />
        )}
      />
      <FormField control={control} name="description" label="Description (optional)" placeholder="e.g. Rent" error={errors.description?.message} />
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      <Button title={isSubmitting ? "Adding..." : "Add recurring"} disabled={isSubmitting} onPress={() => void handleSubmit(onSubmit)()} />
    </FormScreen>
  );
}
