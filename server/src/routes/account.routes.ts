import { Router } from "express";
import * as controller from "../controllers/account.controller";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  changePasswordSchema,
  confirmEmailChangeSchema,
  deleteAccountSchema,
  importBackupSchema,
  previewBackupSchema,
  requestEmailChangeSchema,
  updateProfileSchema,
} from "../validation/account.validation";

// The signed-in user's own account: profile, credentials, data backup.
export const accountRouter = Router();

accountRouter.use(requireAuth);

accountRouter.patch("/profile", validate(updateProfileSchema), controller.updateProfileHandler);
accountRouter.post("/password", validate(changePasswordSchema), controller.changePasswordHandler);
accountRouter.post("/email", validate(requestEmailChangeSchema), controller.requestEmailChangeHandler);
accountRouter.post("/email/confirm", validate(confirmEmailChangeSchema), controller.confirmEmailChangeHandler);
accountRouter.delete("/email/pending", controller.cancelEmailChangeHandler);
accountRouter.post("/sign-out-everywhere", controller.signOutEverywhereHandler);
accountRouter.delete("/", validate(deleteAccountSchema), controller.deleteAccountHandler);

accountRouter.get("/backup", controller.exportBackupHandler);
accountRouter.post("/backup/preview", validate(previewBackupSchema), controller.previewBackupHandler);
accountRouter.post("/backup/import", validate(importBackupSchema), controller.importBackupHandler);
