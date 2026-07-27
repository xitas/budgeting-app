import { Request, Response } from "express";
import * as transactionService from "../services/transaction.service";
import {
  CreateTransactionInput,
  ListTransactionsQuery,
  UpdateTransactionInput,
} from "../validation/transaction.validation";

export async function listTransactionsHandler(req: Request, res: Response): Promise<void> {
  const result = await transactionService.listTransactions(req.userId!, req.query as ListTransactionsQuery);
  res.status(200).json(result);
}

export async function createTransactionHandler(req: Request, res: Response): Promise<void> {
  const transaction = await transactionService.createTransaction(req.userId!, req.body as CreateTransactionInput);
  res.status(201).json({ transaction });
}

export async function updateTransactionHandler(req: Request, res: Response): Promise<void> {
  const transaction = await transactionService.updateTransaction(
    req.userId!,
    req.params.id,
    req.body as UpdateTransactionInput
  );
  res.status(200).json({ transaction });
}

export async function deleteTransactionHandler(req: Request, res: Response): Promise<void> {
  await transactionService.deleteTransaction(req.userId!, req.params.id);
  res.status(204).send();
}
