import { apiClient } from "../../lib/apiClient";
import type { Category, CreateCategoryInput, UpdateCategoryInput } from "./types";

export async function listCategories(): Promise<Category[]> {
  const res = await apiClient.get<{ categories: Category[] }>("/categories");
  return res.data.categories;
}

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  const res = await apiClient.post<{ category: Category }>("/categories", input);
  return res.data.category;
}

export async function updateCategory(id: string, updates: UpdateCategoryInput): Promise<Category> {
  const res = await apiClient.patch<{ category: Category }>(`/categories/${id}`, updates);
  return res.data.category;
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/categories/${id}`);
}
