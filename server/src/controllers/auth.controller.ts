import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { AppError } from "../utils/AppError";
import {
  ForgotPasswordInput,
  LoginInput,
  RefreshInput,
  ResendVerificationInput,
  ResetPasswordInput,
  SignupInput,
  VerifyEmailInput,
} from "../validation/auth.validation";

const REFRESH_COOKIE_NAME = "refreshToken";

// Native mobile apps have no cookie jar worth relying on, so they opt in with
// this header to receive the refresh token in the JSON body instead (and keep
// it in the device's secure storage). Browsers never send it, so the web app
// keeps the refresh token in an httpOnly cookie that JS can't read.
function isMobileClient(req: Request): boolean {
  return req.get("X-Client-Type") === "mobile";
}

export function sendAuthResult(
  req: Request,
  res: Response,
  status: number,
  { user, accessToken, refreshToken }: authService.AuthResult
): void {
  if (isMobileClient(req)) {
    res.status(status).json({ user, accessToken, refreshToken });
    return;
  }
  authService.setRefreshCookie(res, refreshToken);
  res.status(status).json({ user, accessToken });
}

// Same 202 and message whether or not the email was already registered.
export async function signupHandler(req: Request, res: Response): Promise<void> {
  const { email, password, name } = req.body as SignupInput;
  await authService.signup(email, password, name);
  res.status(202).json({ message: "Check your email for a 6-digit code to finish creating your account." });
}

export async function verifyEmailHandler(req: Request, res: Response): Promise<void> {
  const { email, code } = req.body as VerifyEmailInput;
  sendAuthResult(req, res, 200, await authService.verifyEmail(email, code));
}

export async function resendVerificationHandler(req: Request, res: Response): Promise<void> {
  const { email } = req.body as ResendVerificationInput;
  await authService.resendVerification(email);
  res.status(200).json({ message: "If that email still needs verifying, a new code is on its way." });
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
