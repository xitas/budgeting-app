import { zodResolver } from "@hookform/resolvers/zod";
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

const createLoanSchema = z.object({
  counterparty: z.string().trim().min(1, "Counterparty is required"),
  direction: z.enum(["lent", "borrowed"]),
  principal: z.coerce.number({ invalid_type_error: "Enter an amount" }).positive("Principal must be greater than 0"),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
});
type CreateLoanFormValues = z.infer<typeof createLoanSchema>;

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
  } = useForm<CreateLoanFormValues>({
    resolver: zodResolver(createLoanSchema),
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
      <FormField control={control} name="principal" label="Principal" keyboardType="decimal-pad" placeholder="0.00" error={errors.principal?.message} />
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
