import { Router } from "express";
import * as controller from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resetPasswordSchema,
  signupSchema,
} from "../validation/auth.validation";

export const authRouter = Router();

authRouter.post("/signup", validate(signupSchema), controller.signupHandler);
authRouter.post("/login", validate(loginSchema), controller.loginHandler);
authRouter.post("/refresh", validate(refreshSchema), controller.refreshHandler);
authRouter.post("/forgot-password", validate(forgotPasswordSchema), controller.forgotPasswordHandler);
authRouter.post("/reset-password", validate(resetPasswordSchema), controller.resetPasswordHandler);
authRouter.post("/logout", requireAuth, controller.logoutHandler);
authRouter.get("/me", requireAuth, controller.meHandler);
