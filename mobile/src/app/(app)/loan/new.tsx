import { router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { LoanDirection } from "shared";
import { z } from "zod";
import { Button } from "../../../components/ui/Button";
import { DateField } from "../../../components/ui/DateField";
import { FormField } from "../../../components/ui/FormField";
import { FormScreen } from "../../../components/ui/layout";
import { Notice } from "../../../components/ui/Notice";
import { SegmentedControl } from "../../../components/ui/SegmentedControl";
import { useCreateLoan } from "../../../features/loans/hooks";
import { todayIso } from "../../../lib/dates";
import { extractErrorMessage } from "../../../lib/errors";
import { amountField, zodFormResolver } from "../../../lib/money";

const createLoanSchema = z.object({
  counterparty: z.string().trim().min(1, "Counterparty is required"),
  direction: z.enum(["lent", "borrowed"]),
  principalCents: amountField("Principal"),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
});
type CreateLoanFormInput = z.input<typeof createLoanSchema>; // amount as typed text
type CreateLoanFormValues = z.output<typeof createLoanSchema>; // amount in cents

const DIRECTION_OPTIONS: { value: LoanDirection; label: string }[] = [
  { value: "lent", label: "I lent money" },
  { value: "borrowed", label: "I borrowed" },
];

export default function NewLoanScreen() {
  const createLoan = useCreateLoan();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
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
      router.back();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    }
  }

  return (
    <FormScreen>
      <Controller
        control={control}
        name="direction"
        render={({ field }) => (
          <SegmentedControl label="Direction" options={DIRECTION_OPTIONS} value={field.value} onChange={field.onChange} />
        )}
      />
      <FormField control={control} name="counterparty" label="Counterparty" placeholder="Who?" error={errors.counterparty?.message} />
      <FormField control={control} name="principalCents" label="Principal" keyboardType="decimal-pad" placeholder="0.00" error={errors.principalCents?.message} />
      <Controller
        control={control}
        name="date"
        render={({ field }) => <DateField label="Date" value={field.value} onChange={field.onChange} error={errors.date?.message} />}
      />
      <FormField control={control} name="description" label="Description (optional)" error={errors.description?.message} />
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      <Button title={isSubmitting ? "Adding..." : "Add loan"} disabled={isSubmitting} onPress={() => void handleSubmit(onSubmit)()} />
    </FormScreen>
  );
}
