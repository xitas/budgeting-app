import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, Switch, Text, View } from "react-native";
import type { RecurringTransaction } from "shared";
import { z } from "zod";
import { Button } from "../../../components/ui/Button";
import { DateField } from "../../../components/ui/DateField";
import { FormField } from "../../../components/ui/FormField";
import { CenteredMessage, FormScreen } from "../../../components/ui/layout";
import { Notice } from "../../../components/ui/Notice";
import { type Colors } from "../../../components/ui/theme";
import { describeFrequency } from "../../../features/recurring/describe";
import { useDeleteRecurring, useRecurring, useUpdateRecurring } from "../../../features/recurring/hooks";
import { confirmDestructive } from "../../../lib/confirm";
import { formatDisplayDate } from "../../../lib/dates";
import { extractErrorMessage } from "../../../lib/errors";
import { useColors, useSchemeColor, useThemedStyles } from "../../../context/ThemeContext";

// Category, type, frequency, interval and start date are fixed after
// creation (the server rejects changes) — delete and recreate instead.
const editRecurringSchema = z.object({
  amount: z.coerce.number({ invalid_type_error: "Enter an amount" }).positive("Amount must be greater than 0"),
  description: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean(),
});
type EditRecurringFormValues = z.infer<typeof editRecurringSchema>;

export default function EditRecurringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: rules } = useRecurring();
  const rule = rules?.find((r) => r.id === id);

  if (!rule) {
    return <CenteredMessage>Recurring rule not found.</CenteredMessage>;
  }
  return <EditRecurringForm rule={rule} />;
}

function EditRecurringForm({ rule }: { rule: RecurringTransaction }) {
  const schemeColor = useSchemeColor();
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const updateRecurring = useUpdateRecurring();
  const deleteRecurring = useDeleteRecurring();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditRecurringFormValues>({
    resolver: zodResolver(editRecurringSchema),
    defaultValues: {
      amount: rule.amount,
      description: rule.description,
      endDate: rule.endDate?.slice(0, 10) ?? "",
      isActive: rule.isActive,
    },
  });

  async function onSubmit(values: EditRecurringFormValues): Promise<void> {
    setFormError(null);
    try {
      // null clears a previously set end date.
      await updateRecurring.mutateAsync({ id: rule.id, updates: { ...values, endDate: values.endDate || null } });
      router.back();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    }
  }

  async function handleDelete(): Promise<void> {
    const ok = await confirmDestructive(
      "Delete recurring rule?",
      "Stops future transactions. Transactions it already created are kept."
    );
    if (!ok) return;
    setFormError(null);
    try {
      await deleteRecurring.mutateAsync(rule.id);
      router.back();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    }
  }

  return (
    <FormScreen>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: schemeColor(rule.category.color) }]} />
        <Text style={styles.name}>{rule.category.name}</Text>
      </View>
      <Text style={styles.context}>
        {rule.type === "income" ? "Income" : "Expense"} · {describeFrequency(rule.frequency, rule.interval)} · started{" "}
        {formatDisplayDate(rule.startDate)}
      </Text>
      <FormField control={control} name="amount" label="Amount" keyboardType="decimal-pad" error={errors.amount?.message} />
      <FormField control={control} name="description" label="Description (optional)" error={errors.description?.message} />
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
      <Controller
        control={control}
        name="isActive"
        render={({ field }) => (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Active (untick to pause)</Text>
            <Switch accessibilityLabel="Active" value={field.value} onValueChange={field.onChange} trackColor={{ true: colors.primary }} />
          </View>
        )}
      />
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      <Button title={isSubmitting ? "Saving..." : "Save changes"} disabled={isSubmitting} onPress={() => void handleSubmit(onSubmit)()} />
      <Button title="Delete rule" variant="ghost" onPress={() => void handleDelete()} disabled={deleteRecurring.isPending} />
    </FormScreen>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    header: { flexDirection: "row", alignItems: "center", gap: 8 },
    dot: { width: 12, height: 12, borderRadius: 6 },
    name: { fontSize: 18, fontWeight: "600", color: colors.text },
    context: { fontSize: 14, color: colors.textMuted },
    switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    switchLabel: { flex: 1, fontSize: 15, color: colors.text },
  });
