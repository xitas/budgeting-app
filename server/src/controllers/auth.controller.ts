import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { AppError } from "../utils/AppError";
import {
  ForgotPasswordInput,
  LoginInput,
  RefreshInput,
  ResetPasswordInput,
  SignupInput,
} from "../validation/auth.validation";

const REFRESH_COOKIE_NAME = "refreshToken";

// Native mobile apps have no cookie jar worth relying on, so they opt in with
// this header to receive the refresh token in the JSON body instead (and keep
// it in the device's secure storage). Browsers never send it, so the web app
// keeps the refresh token in an httpOnly cookie that JS can't read.
function isMobileClient(req: Request): boolean {
  return req.get("X-Client-Type") === "mobile";
}

function sendAuthResult(
  req: Request,
  res: Response,
  status: number,
  { user, accessToken, refreshToken }: Awaited<ReturnType<typeof authService.login>>
): void {
  if (isMobileClient(req)) {
    res.status(status).json({ user, accessToken, refreshToken });
    return;
  }
  authService.setRefreshCookie(res, refreshToken);
  res.status(status).json({ user, accessToken });
}

export async function signupHandler(req: Request, res: Response): Promise<void> {
  const { email, password, name } = req.body as SignupInput;
  sendAuthResult(req, res, 201, await authService.signup(email, password, name));
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginInput;
  sendAuthResult(req, res, 200, await authService.login(email, password));
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const token = isMobileClient(req)
    ? (req.body as RefreshInput).refreshToken
    : (req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined);
  sendAuthResult(req, res, 200, await authService.refresh(token));
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
