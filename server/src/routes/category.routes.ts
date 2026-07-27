import { Router } from "express";
import * as controller from "../controllers/category.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { categoryIdParamsSchema, createCategorySchema, updateCategorySchema } from "../validation/category.validation";

export const categoryRouter = Router();

categoryRouter.use(requireAuth);

categoryRouter.get("/", controller.listCategoriesHandler);
categoryRouter.post("/", validate(createCategorySchema), controller.createCategoryHandler);
categoryRouter.patch("/:id", validate(updateCategorySchema), controller.updateCategoryHandler);
categoryRouter.delete("/:id", validate(categoryIdParamsSchema), controller.deleteCategoryHandler);
