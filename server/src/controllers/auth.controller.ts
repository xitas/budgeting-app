import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { AppError } from "../utils/AppError";
import {
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  SignupInput,
} from "../validation/auth.validation";

const REFRESH_COOKIE_NAME = "refreshToken";

export async function signupHandler(req: Request, res: Response): Promise<void> {
  const { email, password, name } = req.body as SignupInput;
  const { user, accessToken, refreshToken } = await authService.signup(email, password, name);
  authService.setRefreshCookie(res, refreshToken);
  res.status(201).json({ user, accessToken });
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginInput;
  const { user, accessToken, refreshToken } = await authService.login(email, password);
  authService.setRefreshCookie(res, refreshToken);
  res.status(200).json({ user, accessToken });
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  const { user, accessToken, refreshToken } = await authService.refresh(token);
  authService.setRefreshCookie(res, refreshToken);
  res.status(200).json({ user, accessToken });
}

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  await authService.logout(req.userId);
  authService.clearRefreshCookie(res);
  res.status(204).send();
}

export async function forgotPasswordHandler(req: Request, res: Response): Promise<void> {
  const { email } = req.body as ForgotPasswordInput;
  await authService.requestPasswordReset(email);
  res.status(200).json({ message: "If an account exists for that email, a reset code has been sent." });
}

export async function resetPasswordHandler(req: Request, res: Response): Promise<void> {
  const { email, code, newPassword } = req.body as ResetPasswordInput;
  await authService.resetPassword(email, code, newPassword);
  authService.clearRefreshCookie(res);
  res.status(200).json({ message: "Password updated. Log in with your new password." });
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  const user = await authService.getUserById(req.userId);
  if (!user) {
    throw new AppError(404, "User not found");
  }
  res.status(200).json({ user });
}
