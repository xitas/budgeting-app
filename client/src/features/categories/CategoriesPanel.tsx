import { zodResolver } from "@hookform/resolvers/zod";
import { CATEGORICAL_PALETTE } from "shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Field } from "../../components/ui/Field";
import { buttonClass, inputClass } from "../../components/ui/formStyles";
import { InlineEditActions } from "../../components/ui/InlineEditActions";
import { Modal } from "../../components/ui/Modal";
import { extractErrorMessage } from "../../lib/errors";
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from "./hooks";
import type { Category } from "./types";

const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["income", "expense"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color"),
});

type CreateCategoryFormValues = z.infer<typeof createCategorySchema>;

function ColorSwatchPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      {CATEGORICAL_PALETTE.map((hex) => (
        <button
          key={hex}
          type="button"
          onClick={() => onChange(hex)}
          className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${
            value === hex ? "ring-2 ring-offset-2 ring-slate-400" : ""
          }`}
          style={{ backgroundColor: hex }}
          aria-label={`Choose color ${hex}`}
        />
      ))}
      <input type="color" className="h-6 w-8" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function AddCategoryForm({ onSuccess }: { onSuccess: () => void }) {
  const createCategory = useCreateCategory();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateCategoryFormValues>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { type: "expense", color: CATEGORICAL_PALETTE[0] },
  });
  const selectedColor = watch("color");

  async function onSubmit(values: CreateCategoryFormValues): Promise<void> {
    await createCategory.mutateAsync(values);
    onSuccess();
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
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
        <ColorSwatchPicker value={selectedColor} onChange={(hex) => setValue("color", hex, { shouldValidate: true })} />
      </Field>
      <button type="submit" disabled={isSubmitting} className={`${buttonClass} w-full`}>
        {isSubmitting ? "Adding..." : "Add category"}
      </button>
    </form>
  );
}

function CategoryRow({
  category,
  isEditing,
  draft,
  onDraftChange,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
  isSaving,
  editError,
  deleteError,
}: {
  category: Category;
  isEditing: boolean;
  draft: { name: string; color: string };
  onDraftChange: (draft: { name: string; color: string }) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  isSaving: boolean;
  editError?: string;
  deleteError?: string;
}) {
  if (isEditing) {
    return (
      <li className="space-y-2 rounded-md border-l-2 border-l-blue-400 bg-blue-50/50 px-2 py-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            autoFocus
            className={`${inputClass} py-1`}
            value={draft.name}
            onChange={(e) => onDraftChange({ ...draft, name: e.target.value })}
          />
          <InlineEditActions onSave={onSave} onCancel={onCancel} isSaving={isSaving} />
        </div>
        <ColorSwatchPicker value={draft.color} onChange={(hex) => onDraftChange({ ...draft, color: hex })} />
        {editError && <p className="text-xs text-red-600">{editError}</p>}
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 transition-colors last:border-b-0 hover:bg-slate-50">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
        <span className="text-sm text-slate-800">{category.name}</span>
        {category.isDefault && <span className="text-xs text-slate-400">default</span>}
      </div>
      <div className="flex flex-col items-end">
        <span>
          <button type="button" onClick={onStartEdit} className="mr-2 text-xs text-slate-400 transition-colors hover:text-blue-600">
            Edit
          </button>
          <button type="button" onClick={onDelete} className="text-xs text-slate-400 transition-colors hover:text-red-600">
            Delete
          </button>
        </span>
        {deleteError && <span className="text-xs text-red-600">{deleteError}</span>}
      </div>
    </li>
  );
}

export function CategoriesPanel() {
  const { data: categories, isLoading } = useCategories();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", color: "" });
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  function startEdit(category: Category): void {
    setEditingId(category.id);
    setDraft({ name: category.name, color: category.color });
    setEditError(null);
  }

  function cancelEdit(): void {
    setEditingId(null);
    setEditError(null);
  }

  async function saveEdit(): Promise<void> {
    if (!editingId) return;
    setEditError(null);
    try {
      await updateCategory.mutateAsync({ id: editingId, updates: draft });
      setEditingId(null);
    } catch (err) {
      setEditError(extractErrorMessage(err));
    }
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

  function renderList(list: Category[]) {
    return (
      <ul>
        {list.map((c) => (
          <CategoryRow
            key={c.id}
            category={c}
            isEditing={c.id === editingId}
            draft={draft}
            onDraftChange={setDraft}
            onStartEdit={() => startEdit(c)}
            onSave={() => void saveEdit()}
            onCancel={cancelEdit}
            onDelete={() => void handleDelete(c.id)}
            isSaving={updateCategory.isPending}
            editError={c.id === editingId ? (editError ?? undefined) : undefined}
            deleteError={deleteErrors[c.id]}
          />
        ))}
      </ul>
    );
  }

  return (
    <div>
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : (
        <div className="mb-3 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-medium text-slate-700">Expense</h2>
            {renderList(expenseCategories)}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-medium text-slate-700">Income</h2>
            {renderList(incomeCategories)}
          </div>
        </div>
      )}

      <button type="button" onClick={() => setIsAddOpen(true)} className={`${buttonClass} w-full`}>
        + Add category
      </button>

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add a category">
        <AddCategoryForm onSuccess={() => setIsAddOpen(false)} />
      </Modal>
    </div>
  );
}
