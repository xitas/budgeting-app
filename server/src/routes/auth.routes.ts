import { Router } from "express";
import * as controller from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { loginSchema, signupSchema } from "../validation/auth.validation";

export const authRouter = Router();

authRouter.post("/signup", validate(signupSchema), controller.signupHandler);
authRouter.post("/login", validate(loginSchema), controller.loginHandler);
authRouter.post("/refresh", controller.refreshHandler);
authRouter.post("/logout", requireAuth, controller.logoutHandler);
authRouter.get("/me", requireAuth, controller.meHandler);
