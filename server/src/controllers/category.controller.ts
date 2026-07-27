import { Request, Response } from "express";
import * as categoryService from "../services/category.service";
import { CreateCategoryInput, UpdateCategoryInput } from "../validation/category.validation";

export async function listCategoriesHandler(req: Request, res: Response): Promise<void> {
  const categories = await categoryService.listCategories(req.userId!);
  res.status(200).json({ categories });
}

export async function createCategoryHandler(req: Request, res: Response): Promise<void> {
  const category = await categoryService.createCategory(req.userId!, req.body as CreateCategoryInput);
  res.status(201).json({ category });
}

export async function updateCategoryHandler(req: Request, res: Response): Promise<void> {
  const category = await categoryService.updateCategory(req.userId!, req.params.id, req.body as UpdateCategoryInput);
  res.status(200).json({ category });
}

export async function deleteCategoryHandler(req: Request, res: Response): Promise<void> {
  await categoryService.deleteCategory(req.userId!, req.params.id);
  res.status(204).send();
}
