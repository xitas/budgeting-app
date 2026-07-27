import { Router } from "express";
import * as controller from "../controllers/loan.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  addRepaymentSchema,
  createLoanSchema,
  loanIdParamsSchema,
  repaymentIdParamsSchema,
  updateLoanSchema,
} from "../validation/loan.validation";

export const loanRouter = Router();

loanRouter.use(requireAuth);

loanRouter.get("/", controller.listLoansHandler);
loanRouter.post("/", validate(createLoanSchema), controller.createLoanHandler);
loanRouter.patch("/:id", validate(updateLoanSchema), controller.updateLoanHandler);
loanRouter.delete("/:id", validate(loanIdParamsSchema), controller.deleteLoanHandler);
loanRouter.post("/:id/repayments", validate(addRepaymentSchema), controller.addRepaymentHandler);
loanRouter.delete("/:id/repayments/:repaymentId", validate(repaymentIdParamsSchema), controller.removeRepaymentHandler);
