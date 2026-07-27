import { Router } from "express";
import * as controller from "../controllers/transaction.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createTransactionSchema,
  listTransactionsSchema,
  transactionIdParamsSchema,
  updateTransactionSchema,
} from "../validation/transaction.validation";

export const transactionRouter = Router();

transactionRouter.use(requireAuth);

transactionRouter.get("/", validate(listTransactionsSchema), controller.listTransactionsHandler);
transactionRouter.post("/", validate(createTransactionSchema), controller.createTransactionHandler);
transactionRouter.patch("/:id", validate(updateTransactionSchema), controller.updateTransactionHandler);
transactionRouter.delete("/:id", validate(transactionIdParamsSchema), controller.deleteTransactionHandler);
