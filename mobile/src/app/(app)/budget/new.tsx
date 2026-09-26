import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, Text } from "react-native";
import { z } from "zod";
import { Button } from "../../../components/ui/Button";
import { CategoryPicker } from "../../../components/ui/CategoryPicker";
import { FormField } from "../../../components/ui/FormField";
import { FormScreen } from "../../../components/ui/layout";
import { Notice } from "../../../components/ui/Notice";
import { type Colors } from "../../../components/ui/theme";
import { useBudgets, useCreateBudget } from "../../../features/budgets/hooks";
import { useCategories } from "../../../features/categories/hooks";
import { MONTH_NAMES } from "../../../lib/dates";
import { extractErrorMessage } from "../../../lib/errors";
import { useThemedStyles } from "../../../context/ThemeContext";

const budgetFormSchema = z.object({
  category: z.string().min(1, "Category is required"),
  limit: z.coerce.number({ invalid_type_error: "Enter an amount" }).positive("Limit must be greater than 0"),
});
type BudgetFormValues = z.infer<typeof budgetFormSchema>;

export default function NewBudgetScreen() {
  const styles = useThemedStyles(makeStyles);
  const params = useLocalSearchParams<{ month: string; year: string }>();
  const month = Number(params.month);
  const year = Number(params.year);
  const { data: categories } = useCategories();
  const { data: budgets } = useBudgets(month, year);
  const createBudget = useCreateBudget();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BudgetFormValues>({ resolver: zodResolver(budgetFormSchema) });

  // Budgets are expense-only, one per category per month.
  const budgeted = new Set(budgets?.map((b) => b.category.id));
  const available = (categories ?? []).filter((c) => c.type === "expense" && !budgeted.has(c.id));

  async function onSubmit(values: BudgetFormValues): Promise<void> {
    setFormError(null);
    try {
      await createBudget.mutateAsync({ ...values, month, year });
      router.back();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    }
  }

  return (
    <FormScreen>
      <Text style={styles.context}>
        For {MONTH_NAMES[month - 1]} {year}
      </Text>
      <Controller
        control={control}
        name="category"
        render={({ field }) => (
          <CategoryPicker
            label="Expense category"
            categories={available}
            value={field.value}
            onChange={field.onChange}
            error={errors.category?.message}
            emptyText="Every expense category already has a budget this month."
          />
        )}
      />
      <FormField control={control} name="limit" label="Monthly limit" keyboardType="decimal-pad" placeholder="0.00" error={errors.limit?.message} />
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      <Button title={isSubmitting ? "Adding..." : "Add budget"} disabled={isSubmitting} onPress={() => void handleSubmit(onSubmit)()} />
    </FormScreen>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    context: { fontSize: 14, color: colors.textMuted },
  });
