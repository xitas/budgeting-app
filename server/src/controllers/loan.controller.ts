import { Request, Response } from "express";
import * as loanService from "../services/loan.service";
import { AddRepaymentInput, CreateLoanInput, UpdateLoanInput } from "../validation/loan.validation";

export async function listLoansHandler(req: Request, res: Response): Promise<void> {
  const loans = await loanService.listLoans(req.userId!);
  res.status(200).json({ loans });
}

export async function createLoanHandler(req: Request, res: Response): Promise<void> {
  const loan = await loanService.createLoan(req.userId!, req.body as CreateLoanInput);
  res.status(201).json({ loan });
}

export async function updateLoanHandler(req: Request, res: Response): Promise<void> {
  const loan = await loanService.updateLoan(req.userId!, req.params.id, req.body as UpdateLoanInput);
  res.status(200).json({ loan });
}

export async function deleteLoanHandler(req: Request, res: Response): Promise<void> {
  await loanService.deleteLoan(req.userId!, req.params.id);
  res.status(204).send();
}

export async function addRepaymentHandler(req: Request, res: Response): Promise<void> {
  const loan = await loanService.addRepayment(req.userId!, req.params.id, req.body as AddRepaymentInput);
  res.status(201).json({ loan });
}

export async function removeRepaymentHandler(req: Request, res: Response): Promise<void> {
  const loan = await loanService.removeRepayment(req.userId!, req.params.id, req.params.repaymentId);
  res.status(200).json({ loan });
}
