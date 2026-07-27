import { Router } from "express";
import * as controller from "../controllers/recurring.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createRecurringSchema, recurringIdParamsSchema, updateRecurringSchema } from "../validation/recurring.validation";

export const recurringRouter = Router();

recurringRouter.use(requireAuth);

recurringRouter.get("/", controller.listRecurringHandler);
recurringRouter.post("/", validate(createRecurringSchema), controller.createRecurringHandler);
recurringRouter.patch("/:id", validate(updateRecurringSchema), controller.updateRecurringHandler);
recurringRouter.delete("/:id", validate(recurringIdParamsSchema), controller.deleteRecurringHandler);
recurringRouter.post("/:id/run-now", validate(recurringIdParamsSchema), controller.runNowHandler);
