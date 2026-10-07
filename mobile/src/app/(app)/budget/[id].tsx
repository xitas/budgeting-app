import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { StyleSheet, Text, View } from "react-native";
import { centsToDecimalString, type Budget } from "shared";
import { z } from "zod";
import { Button } from "../../../components/ui/Button";
import { FormField } from "../../../components/ui/FormField";
import { CenteredMessage, FormScreen } from "../../../components/ui/layout";
import { Notice } from "../../../components/ui/Notice";
import { type Colors } from "../../../components/ui/theme";
import { useBudgets, useDeleteBudget, useUpdateBudget } from "../../../features/budgets/hooks";
import { confirmDestructive } from "../../../lib/confirm";
import { MONTH_NAMES } from "../../../lib/dates";
import { extractErrorMessage } from "../../../lib/errors";
import { amountField, zodFormResolver } from "../../../lib/money";
import { useSchemeColor, useThemedStyles } from "../../../context/ThemeContext";
import { useMoney } from "../../../lib/useMoney";

const editBudgetSchema = z.object({
  limitCents: amountField("Limit"),
});
type EditBudgetFormInput = z.input<typeof editBudgetSchema>; // amount as typed text
type EditBudgetFormValues = z.output<typeof editBudgetSchema>; // amount in cents

export default function EditBudgetScreen() {
  const params = useLocalSearchParams<{ id: string; month: string; year: string }>();
  const { data: budgets } = useBudgets(Number(params.month), Number(params.year));
  const budget = budgets?.find((b) => b.id === params.id);

  if (!budget) {
    return <CenteredMessage>Budget not found.</CenteredMessage>;
  }
  return <EditBudgetForm budget={budget} />;
}

function EditBudgetForm({ budget }: { budget: Budget }) {
  const money = useMoney();
  const schemeColor = useSchemeColor();
  const styles = useThemedStyles(makeStyles);
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditBudgetFormInput, unknown, EditBudgetFormValues>({ resolver: zodFormResolver(editBudgetSchema), defaultValues: { limitCents: centsToDecimalString(budget.limitCents) } });

  async function onSubmit(values: EditBudgetFormValues): Promise<void> {
    setFormError(null);
    try {
      await updateBudget.mutateAsync({ id: budget.id, updates: values });
      router.back();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    }
  }

  async function handleDelete(): Promise<void> {
    if (!(await confirmDestructive("Delete budget?", `Removes the ${budget.category.name} limit for this month.`))) return;
    setFormError(null);
    try {
      await deleteBudget.mutateAsync(budget.id);
      router.back();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    }
  }

  return (
    <FormScreen>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: schemeColor(budget.category.color) }]} />
        <Text style={styles.name}>{budget.category.name}</Text>
      </View>
      <Text style={styles.context}>
        {MONTH_NAMES[budget.month - 1]} {budget.year} · spent {money.format(budget.spentCents)} so far
      </Text>
      <FormField control={control} name="limitCents" label="Monthly limit" keyboardType="decimal-pad" error={errors.limitCents?.message} />
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      <Button title={isSubmitting ? "Saving..." : "Save changes"} disabled={isSubmitting} onPress={() => void handleSubmit(onSubmit)()} />
      <Button title="Delete budget" variant="ghost" onPress={() => void handleDelete()} disabled={deleteBudget.isPending} />
    </FormScreen>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    header: { flexDirection: "row", alignItems: "center", gap: 8 },
    dot: { width: 12, height: 12, borderRadius: 6 },
    name: { fontSize: 18, fontWeight: "600", color: colors.text },
    context: { fontSize: 14, color: colors.textMuted },
  });
