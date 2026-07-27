import { Router } from "express";
import * as controller from "../controllers/dashboard.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { dashboardQuerySchema, trendQuerySchema } from "../validation/dashboard.validation";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get("/summary", validate(dashboardQuerySchema), controller.getSummaryHandler);
dashboardRouter.get("/spending-by-category", validate(dashboardQuerySchema), controller.getSpendingByCategoryHandler);
dashboardRouter.get("/income-vs-expense", validate(trendQuerySchema), controller.getIncomeVsExpenseHandler);
dashboardRouter.get("/budget-vs-actual", validate(dashboardQuerySchema), controller.getBudgetVsActualHandler);
