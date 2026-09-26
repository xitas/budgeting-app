import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, Text } from "react-native";
import { z } from "zod";
import { Button } from "../../../components/ui/Button";
import { DateField } from "../../../components/ui/DateField";
import { FormField } from "../../../components/ui/FormField";
import { FormScreen } from "../../../components/ui/layout";
import { Notice } from "../../../components/ui/Notice";
import { colors } from "../../../components/ui/theme";
import { useAddRepayment, useLoans } from "../../../features/loans/hooks";
import { todayIso } from "../../../lib/dates";
import { extractErrorMessage } from "../../../lib/errors";

const addRepaymentSchema = z.object({
  amount: z.coerce.number({ invalid_type_error: "Enter an amount" }).positive("Amount must be greater than 0"),
  date: z.string().min(1, "Date is required"),
  note: z.string().optional(),
});
type AddRepaymentFormValues = z.infer<typeof addRepaymentSchema>;

export default function AddRepaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: loans } = useLoans();
  const loan = loans?.find((l) => l.id === id);
  const addRepayment = useAddRepayment();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddRepaymentFormValues>({
    resolver: zodResolver(addRepaymentSchema),
    // Suggest paying off whatever is left.
    defaultValues: { date: todayIso(), amount: loan && loan.outstanding > 0 ? loan.outstanding : undefined },
  });

  async function onSubmit(values: AddRepaymentFormValues): Promise<void> {
    setFormError(null);
    try {
      await addRepayment.mutateAsync({ id, input: values });
      router.back();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    }
  }

  return (
    <FormScreen>
      {loan ? (
        <Text style={styles.context}>
          {loan.direction === "lent" ? `${loan.counterparty} paying you back` : `You paying back ${loan.counterparty}`} ·{" "}
          {loan.outstanding.toFixed(2)} outstanding
        </Text>
      ) : null}
      <FormField control={control} name="amount" label="Amount" keyboardType="decimal-pad" placeholder="0.00" error={errors.amount?.message} />
      <Controller
        control={control}
        name="date"
        render={({ field }) => <DateField label="Date" value={field.value} onChange={field.onChange} error={errors.date?.message} />}
      />
      <FormField control={control} name="note" label="Note (optional)" error={errors.note?.message} />
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      <Button title={isSubmitting ? "Adding..." : "Add repayment"} disabled={isSubmitting} onPress={() => void handleSubmit(onSubmit)()} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  context: { fontSize: 14, color: colors.textMuted },
});
