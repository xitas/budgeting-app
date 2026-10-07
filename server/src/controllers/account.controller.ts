import { Request, Response } from "express";
import * as accountService from "../services/account.service";
import * as authService from "../services/auth.service";
import * as backupService from "../services/backup.service";
import {
  ChangePasswordInput,
  ConfirmEmailChangeInput,
  DeleteAccountInput,
  ImportBackupInput,
  RequestEmailChangeInput,
  UpdateProfileInput,
} from "../validation/account.validation";
import { sendAuthResult } from "./auth.controller";

export async function updateProfileHandler(req: Request, res: Response): Promise<void> {
  const user = await accountService.updateProfile(req.userId!, req.body as UpdateProfileInput);
  res.status(200).json({ user });
}

// Answers like a login: new tokens (other devices are signed out).
export async function changePasswordHandler(req: Request, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.body as ChangePasswordInput;
  sendAuthResult(req, res, 200, await accountService.changePassword(req.userId!, currentPassword, newPassword));
}

export async function requestEmailChangeHandler(req: Request, res: Response): Promise<void> {
  const { newEmail, password } = req.body as RequestEmailChangeInput;
  const user = await accountService.requestEmailChange(req.userId!, newEmail, password);
  res.status(200).json({ user, message: `We sent a 6-digit code to ${user.pendingEmail}. Enter it to finish the change.` });
}

export async function confirmEmailChangeHandler(req: Request, res: Response): Promise<void> {
  const { code } = req.body as ConfirmEmailChangeInput;
  res.status(200).json({ user: await accountService.confirmEmailChange(req.userId!, code) });
}

export async function cancelEmailChangeHandler(req: Request, res: Response): Promise<void> {
  res.status(200).json({ user: await accountService.cancelEmailChange(req.userId!) });
}

export async function signOutEverywhereHandler(req: Request, res: Response): Promise<void> {
  await accountService.signOutEverywhere(req.userId!);
  authService.clearRefreshCookie(res);
  res.status(204).send();
}

export async function deleteAccountHandler(req: Request, res: Response): Promise<void> {
  const { password } = req.body as DeleteAccountInput;
  await accountService.deleteAccount(req.userId!, password);
  authService.clearRefreshCookie(res);
  res.status(204).send();
}

export async function exportBackupHandler(req: Request, res: Response): Promise<void> {
  const backup = await backupService.exportBackup(req.userId!);
  const day = backup.exportedAt.slice(0, 10);
  res.setHeader("Content-Disposition", `attachment; filename="budget-backup-${day}.json"`);
  res.status(200).json(backup);
}

export async function previewBackupHandler(req: Request, res: Response): Promise<void> {
  res.status(200).json(await backupService.previewBackup(req.userId!, (req.body as { backup: unknown }).backup));
}

export async function importBackupHandler(req: Request, res: Response): Promise<void> {
  const { backup, replaceExisting } = req.body as ImportBackupInput;
  res.status(200).json({ summary: await backupService.importBackup(req.userId!, backup, replaceExisting) });
}
