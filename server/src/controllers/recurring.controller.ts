import { Request, Response } from "express";
import * as recurringService from "../services/recurring.service";
import { CreateRecurringInput, UpdateRecurringInput } from "../validation/recurring.validation";

export async function listRecurringHandler(req: Request, res: Response): Promise<void> {
  const recurring = await recurringService.listRecurring(req.userId!);
  res.status(200).json({ recurring });
}

export async function createRecurringHandler(req: Request, res: Response): Promise<void> {
  const recurring = await recurringService.createRecurring(req.userId!, req.body as CreateRecurringInput);
  res.status(201).json({ recurring });
}

export async function updateRecurringHandler(req: Request, res: Response): Promise<void> {
  const recurring = await recurringService.updateRecurring(req.userId!, req.params.id, req.body as UpdateRecurringInput);
  res.status(200).json({ recurring });
}

export async function deleteRecurringHandler(req: Request, res: Response): Promise<void> {
  await recurringService.deleteRecurring(req.userId!, req.params.id);
  res.status(204).send();
}

export async function runNowHandler(req: Request, res: Response): Promise<void> {
  const generated = await recurringService.runNow(req.userId!, req.params.id);
  res.status(200).json({ generated });
}
