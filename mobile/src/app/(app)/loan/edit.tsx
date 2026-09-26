import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, Switch, Text, View } from "react-native";
import type { Loan } from "shared";
import { z } from "zod";
import { Button } from "../../../components/ui/Button";
import { DateField } from "../../../components/ui/DateField";
import { FormField } from "../../../components/ui/FormField";
import { CenteredMessage, FormScreen } from "../../../components/ui/layout";
import { Notice } from "../../../components/ui/Notice";
import { colors } from "../../../components/ui/theme";
import { useLoans, useUpdateLoan } from "../../../features/loans/hooks";
import { extractErrorMessage } from "../../../lib/errors";

// Direction isn't editable: flipping it would invert the cash flow of the
// loan's already-recorded transaction (the server rejects it too).
const editLoanSchema = z.object({
  counterparty: z.string().trim().min(1, "Counterparty is required"),
  principal: z.coerce.number({ invalid_type_error: "Enter an amount" }).positive("Principal must be greater than 0"),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  writtenOff: z.boolean(),
});
type EditLoanFormValues = z.infer<typeof editLoanSchema>;

export default function EditLoanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: loans } = useLoans();
  const loan = loans?.find((l) => l.id === id);

  if (!loan) {
    return <CenteredMessage>Loan not found.</CenteredMessage>;
  }
  return <EditLoanForm loan={loan} />;
}

function EditLoanForm({ loan }: { loan: Loan }) {
  const updateLoan = useUpdateLoan();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditLoanFormValues>({
    resolver: zodResolver(editLoanSchema),
    defaultValues: {
      counterparty: loan.counterparty,
      principal: loan.principal,
      description: loan.description,
      date: loan.date.slice(0, 10),
      writtenOff: loan.writtenOff,
    },
  });

  async function onSubmit(values: EditLoanFormValues): Promise<void> {
    setFormError(null);
    try {
      await updateLoan.mutateAsync({ id: loan.id, updates: values });
      router.back();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    }
  }

  const writeOffLabel = loan.direction === "lent" ? "Write off (won't be repaid)" : "Forgiven (won't need repaying)";

  return (
    <FormScreen>
      <FormField control={control} name="counterparty" label="Counterparty" error={errors.counterparty?.message} />
      <FormField control={control} name="principal" label="Principal" keyboardType="decimal-pad" error={errors.principal?.message} />
      <Controller
        control={control}
        name="date"
        render={({ field }) => <DateField label="Date" value={field.value} onChange={field.onChange} error={errors.date?.message} />}
      />
      <FormField control={control} name="description" label="Description (optional)" error={errors.description?.message} />
      <Controller
        control={control}
        name="writtenOff"
        render={({ field }) => (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{writeOffLabel}</Text>
            <Switch
              accessibilityLabel={writeOffLabel}
              value={field.value}
              onValueChange={field.onChange}
              trackColor={{ true: colors.primary }}
            />
          </View>
        )}
      />
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      <Button title={isSubmitting ? "Saving..." : "Save changes"} disabled={isSubmitting} onPress={() => void handleSubmit(onSubmit)()} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  switchLabel: { flex: 1, fontSize: 15, color: colors.text },
});
