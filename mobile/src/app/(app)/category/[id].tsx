import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { StyleSheet, Text } from "react-native";
import type { Category } from "shared";
import { z } from "zod";
import { Button } from "../../../components/ui/Button";
import { ColorSwatchPicker } from "../../../components/ui/ColorSwatchPicker";
import { FormField } from "../../../components/ui/FormField";
import { CenteredMessage, FormScreen } from "../../../components/ui/layout";
import { Notice } from "../../../components/ui/Notice";
import { colors } from "../../../components/ui/theme";
import { useCategories, useDeleteCategory, useUpdateCategory } from "../../../features/categories/hooks";
import { confirmDestructive } from "../../../lib/confirm";
import { extractErrorMessage } from "../../../lib/errors";

// Type is fixed after creation (existing transactions depend on it).
const editCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color"),
});
type EditCategoryFormValues = z.infer<typeof editCategorySchema>;

export default function EditCategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: categories } = useCategories();
  const category = categories?.find((c) => c.id === id);

  if (!category) {
    return <CenteredMessage>Category not found.</CenteredMessage>;
  }
  return <EditCategoryForm category={category} />;
}

function EditCategoryForm({ category }: { category: Category }) {
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditCategoryFormValues>({
    resolver: zodResolver(editCategorySchema),
    defaultValues: { name: category.name, color: category.color },
  });

  async function onSubmit(values: EditCategoryFormValues): Promise<void> {
    setFormError(null);
    try {
      await updateCategory.mutateAsync({ id: category.id, updates: values });
      router.back();
    } catch (err) {
      setFormError(extractErrorMessage(err));
    }
  }

  async function handleDelete(): Promise<void> {
    if (!(await confirmDestructive(`Delete "${category.name}"?`, "Only possible while no transactions use it."))) return;
    setFormError(null);
    try {
      await deleteCategory.mutateAsync(category.id);
      router.back();
    } catch (err) {
      // e.g. 409 "Cannot delete a category that has transactions..."
      setFormError(extractErrorMessage(err));
    }
  }

  return (
    <FormScreen>
      <Text style={styles.context}>{category.type === "expense" ? "Expense category" : "Income category"}</Text>
      <FormField control={control} name="name" label="Name" error={errors.name?.message} />
      <Controller
        control={control}
        name="color"
        render={({ field }) => <ColorSwatchPicker label="Color" value={field.value} onChange={field.onChange} error={errors.color?.message} />}
      />
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      <Button title={isSubmitting ? "Saving..." : "Save changes"} disabled={isSubmitting} onPress={() => void handleSubmit(onSubmit)()} />
      <Button title="Delete category" variant="ghost" onPress={() => void handleDelete()} disabled={deleteCategory.isPending} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  context: { fontSize: 14, color: colors.textMuted },
});
