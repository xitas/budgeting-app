import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, Text } from "react-native";
import { centsToDecimalString } from "shared";
import { z } from "zod";
import { Button } from "../../../components/ui/Button";
import { DateField } from "../../../components/ui/DateField";
import { FormField } from "../../../components/ui/FormField";
import { FormScreen } from "../../../components/ui/layout";
import { Notice } from "../../../components/ui/Notice";
import { type Colors } from "../../../components/ui/theme";
import { useAddRepayment, useLoans } from "../../../features/loans/hooks";
import { todayIso } from "../../../lib/dates";
import { extractErrorMessage } from "../../../lib/errors";
import { amountField, zodFormResolver } from "../../../lib/money";
import { useThemedStyles } from "../../../context/ThemeContext";
import { useMoney } from "../../../lib/useMoney";

const addRepaymentSchema = z.object({
  amountCents: amountField("Amount"),
  date: z.string().min(1, "Date is required"),
  note: z.string().optional(),
});
type AddRepaymentFormInput = z.input<typeof addRepaymentSchema>; // amount as typed text
type AddRepaymentFormValues = z.output<typeof addRepaymentSchema>; // amount in cents

export default function AddRepaymentScreen() {
  const money = useMoney();
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: loans } = useLoans();
  const loan = loans?.find((l) => l.id === id);
  const addRepayment = useAddRepayment();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddRepaymentFormInput, unknown, AddRepaymentFormValues>({
    resolver: zodFormResolver(addRepaymentSchema),
    // Suggest paying off whatever is left.
    defaultValues: { date: todayIso(), amountCents: loan && loan.outstandingCents > 0 ? centsToDecimalString(loan.outstandingCents) : undefined },
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
          {money.format(loan.outstandingCents)} outstanding
        </Text>
      ) : null}
      <FormField control={control} name="amountCents" label="Amount" keyboardType="decimal-pad" placeholder="0.00" error={errors.amountCents?.message} />
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

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    context: { fontSize: 14, color: colors.textMuted },
  });
