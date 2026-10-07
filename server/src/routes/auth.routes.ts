import { RequestHandler, Router } from "express";
import * as controller from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { AuthRateLimitConfig, createAuthRateLimiters } from "../middleware/rateLimit";
import { validate } from "../middleware/validate";
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  signupSchema,
  verifyEmailSchema,
} from "../validation/auth.validation";

const noLimit: RequestHandler = (_req, _res, next) => next();

// Built per app so each instance gets its own limiter counters (and tests
// can pass their own limits). Limiters run before validation, so malformed
// requests count too.
export function createAuthRouter(rateLimits: AuthRateLimitConfig | false): Router {
  const authRouter = Router();
  const limit = rateLimits ? createAuthRateLimiters(rateLimits) : { login: noLimit, signup: noLimit };

  authRouter.post("/signup", limit.signup, validate(signupSchema), controller.signupHandler);
  authRouter.post("/login", limit.login, validate(loginSchema), controller.loginHandler);
  authRouter.post("/verify-email", validate(verifyEmailSchema), controller.verifyEmailHandler);
  // Sends email, so it shares sign-up's per-IP budget.
  authRouter.post("/verify-email/resend", limit.signup, validate(resendVerificationSchema), controller.resendVerificationHandler);
  authRouter.post("/refresh", validate(refreshSchema), controller.refreshHandler);
  authRouter.post("/forgot-password", validate(forgotPasswordSchema), controller.forgotPasswordHandler);
  authRouter.post("/reset-password", validate(resetPasswordSchema), controller.resetPasswordHandler);
  authRouter.post("/logout", requireAuth, controller.logoutHandler);
  authRouter.get("/me", requireAuth, controller.meHandler);
  return authRouter;
}
