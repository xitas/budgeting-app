import { Router } from "express";
import * as controller from "../controllers/budget.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { budgetIdParamsSchema, createBudgetSchema, listBudgetsSchema, updateBudgetSchema } from "../validation/budget.validation";

export const budgetRouter = Router();

budgetRouter.use(requireAuth);

budgetRouter.get("/", validate(listBudgetsSchema), controller.listBudgetsHandler);
budgetRouter.post("/", validate(createBudgetSchema), controller.createBudgetHandler);
budgetRouter.patch("/:id", validate(updateBudgetSchema), controller.updateBudgetHandler);
budgetRouter.delete("/:id", validate(budgetIdParamsSchema), controller.deleteBudgetHandler);
