import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { CATEGORICAL_PALETTE, type TransactionType } from "shared";
import { z } from "zod";
import { Button } from "../../../components/ui/Button";
import { ColorSwatchPicker } from "../../../components/ui/ColorSwatchPicker";
import { FormField } from "../../../components/ui/FormField";
import { FormScreen } from "../../../components/ui/layout";
import { Notice } from "../../../components/ui/Notice";
import { SegmentedControl } from "../../../components/ui/SegmentedControl";
import { useCreateCategory } from "../../../features/categories/hooks";
import { extractErrorMessage } from "../../../lib/errors";

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  type: z.enum(["income", "expense"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color"),
});
type CreateCategoryFormValues = z.infer<typeof createCategorySchema>;

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

export default function NewCategoryScreen() {
  const createCategory = useCreateCategory();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateCategoryFormValues>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { type: "expense", color: CATEGORICAL_PALETTE[0] },
  });

  async function onSubmit(values: CreateCategoryFormValues): Promise<void> {
    setFormError(null);
    try {
      await createCategory.mutateAsync(values);
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
        render={({ field }) => <SegmentedControl label="Type" options={TYPE_OPTIONS} value={field.value} onChange={field.onChange} />}
      />
      <FormField control={control} name="name" label="Name" error={errors.name?.message} />
      <Controller
        control={control}
        name="color"
        render={({ field }) => <ColorSwatchPicker label="Color" value={field.value} onChange={field.onChange} error={errors.color?.message} />}
      />
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      <Button title={isSubmitting ? "Adding..." : "Add category"} disabled={isSubmitting} onPress={() => void handleSubmit(onSubmit)()} />
    </FormScreen>
  );
}
