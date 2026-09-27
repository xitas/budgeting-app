import { Router } from "express";
import * as controller from "../controllers/transaction.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createTransactionSchema,
  exportTransactionsSchema,
  importCheckSchema,
  importTransactionsSchema,
  listTransactionsSchema,
  transactionIdParamsSchema,
  updateTransactionSchema,
} from "../validation/transaction.validation";

export const transactionRouter = Router();

transactionRouter.use(requireAuth);

transactionRouter.get("/", validate(listTransactionsSchema), controller.listTransactionsHandler);
transactionRouter.get("/export", validate(exportTransactionsSchema), controller.exportTransactionsHandler);
transactionRouter.post("/", validate(createTransactionSchema), controller.createTransactionHandler);
transactionRouter.post("/import/check", validate(importCheckSchema), controller.checkImportHandler);
transactionRouter.post("/import", validate(importTransactionsSchema), controller.importTransactionsHandler);
transactionRouter.patch("/:id", validate(updateTransactionSchema), controller.updateTransactionHandler);
transactionRouter.delete("/:id", validate(transactionIdParamsSchema), controller.deleteTransactionHandler);
