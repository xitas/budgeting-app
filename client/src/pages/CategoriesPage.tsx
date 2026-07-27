import { zodResolver } from "@hookform/resolvers/zod";
import { CATEGORICAL_PALETTE } from "shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Field } from "../components/ui/Field";
import { buttonClass, inputClass } from "../components/ui/formStyles";
import { useCategories, useCreateCategory, useDeleteCategory } from "../features/categories/hooks";
import type { Category } from "../features/categories/types";
import { extractErrorMessage } from "../lib/errors";

const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["income", "expense"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color"),
});

type CreateCategoryFormValues = z.infer<typeof createCategorySchema>;

function CategoryRow({ category, onDelete, deleteError }: { category: Category; onDelete: (id: string) => void; deleteError?: string }) {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
        <span className="text-sm text-slate-800">{category.name}</span>
        {category.isDefault && <span className="text-xs text-slate-400">default</span>}
      </div>
      <div className="flex flex-col items-end">
        <button
          type="button"
          onClick={() => onDelete(category.id)}
          className="text-xs text-slate-400 hover:text-red-600"
        >
          Delete
        </button>
        {deleteError && <span className="text-xs text-red-600">{deleteError}</span>}
      </div>
    </li>
  );
}

export function CategoriesPage() {
  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCategoryFormValues>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { type: "expense", color: CATEGORICAL_PALETTE[0] },
  });
  const selectedColor = watch("color");

  async function onSubmit(values: CreateCategoryFormValues): Promise<void> {
    await createCategory.mutateAsync(values);
    reset({ name: "", type: values.type, color: CATEGORICAL_PALETTE[0] });
  }

  async function handleDelete(id: string): Promise<void> {
    setDeleteErrors((prev) => ({ ...prev, [id]: "" }));
    try {
      await deleteCategory.mutateAsync(id);
    } catch (err) {
      setDeleteErrors((prev) => ({ ...prev, [id]: extractErrorMessage(err) }));
    }
  }

  const expenseCategories = categories?.filter((c) => c.type === "expense") ?? [];
  const incomeCategories = categories?.filter((c) => c.type === "income") ?? [];

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Categories</h1>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-medium text-slate-700">Expense</h2>
            <ul>
              {expenseCategories.map((c) => (
                <CategoryRow key={c.id} category={c} onDelete={handleDelete} deleteError={deleteErrors[c.id]} />
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-medium text-slate-700">Income</h2>
            <ul>
              {incomeCategories.map((c) => (
                <CategoryRow key={c.id} category={c} onDelete={handleDelete} deleteError={deleteErrors[c.id]} />
              ))}
            </ul>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-4"
      >
        <h2 className="text-sm font-medium text-slate-700">Add a category</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" error={errors.name?.message}>
            <input type="text" className={inputClass} {...register("name")} />
          </Field>
          <Field label="Type" error={errors.type?.message}>
            <select className={inputClass} {...register("type")}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </Field>
        </div>
        <Field label="Color" error={errors.color?.message}>
          <div className="flex items-center gap-2">
            {CATEGORICAL_PALETTE.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => setValue("color", hex, { shouldValidate: true })}
                className={`h-6 w-6 rounded-full ${selectedColor === hex ? "ring-2 ring-offset-2 ring-slate-400" : ""}`}
                style={{ backgroundColor: hex }}
                aria-label={`Choose color ${hex}`}
              />
            ))}
            <input type="color" className="h-6 w-8" {...register("color")} />
          </div>
        </Field>
        <button type="submit" disabled={isSubmitting} className={buttonClass}>
          {isSubmitting ? "Adding..." : "Add category"}
        </button>
      </form>
    </div>
  );
}
