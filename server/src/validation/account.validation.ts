import { CURRENCY_CODES } from "shared";
import { z } from "zod";
import { sixDigitCode } from "./auth.validation";

const password = z.string().min(1, "Password is required");
const newPassword = z.string().min(8, "Password must be at least 8 characters");

export const updateProfileSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1, "Name is required").max(100).optional(),
      currency: z.enum(CURRENCY_CODES, { errorMap: () => ({ message: `Currency must be one of ${CURRENCY_CODES.join(", ")}` }) }).optional(),
    })
    .refine((b) => b.name !== undefined || b.currency !== undefined, "Nothing to update"),
});

export const changePasswordSchema = z.object({
  body: z.object({ currentPassword: password, newPassword }),
});

export const requestEmailChangeSchema = z.object({
  body: z.object({ newEmail: z.string().email("Enter a valid email address"), password }),
});

export const confirmEmailChangeSchema = z.object({
  body: z.object({ code: sixDigitCode }),
});

export const deleteAccountSchema = z.object({
  body: z.object({ password }),
});

// The backup itself is validated by backup.service (it knows the format
// versions); here only the envelope.
export const previewBackupSchema = z.object({
  body: z.object({ backup: z.unknown() }),
});

export const importBackupSchema = z.object({
  body: z.object({ backup: z.unknown(), replaceExisting: z.boolean().default(false) }),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>["body"];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>["body"];
export type RequestEmailChangeInput = z.infer<typeof requestEmailChangeSchema>["body"];
export type ConfirmEmailChangeInput = z.infer<typeof confirmEmailChangeSchema>["body"];
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>["body"];
export type ImportBackupInput = z.infer<typeof importBackupSchema>["body"];
