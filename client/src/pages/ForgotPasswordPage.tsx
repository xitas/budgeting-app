import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { AuthFormLayout } from "../components/ui/AuthFormLayout";
import { Field } from "../components/ui/Field";
import { buttonClass, inputClass } from "../components/ui/formStyles";
import * as authApi from "../features/auth/api";
import { extractErrorMessage } from "../lib/errors";

const emailSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

const resetSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from the email"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type EmailFormValues = z.infer<typeof emailSchema>;
type ResetFormValues = z.infer<typeof resetSchema>;

export function ForgotPasswordPage() {
  const [email, setEmail] = useState<string | null>(null);

  return (
    <AuthFormLayout title="Reset password">
      {email === null ? (
        <RequestCodeStep onSent={setEmail} />
      ) : (
        <EnterCodeStep email={email} onChangeEmail={() => setEmail(null)} />
      )}
      <p className="mt-4 text-sm text-slate-600">
        Remembered it?{" "}
        <Link to="/login" className="text-link hover:underline">
          Log in
        </Link>
      </p>
    </AuthFormLayout>
  );
}

function RequestCodeStep({ onSent }: { onSent: (email: string) => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailFormValues>({ resolver: zodResolver(emailSchema) });

  async function onSubmit(values: EmailFormValues): Promise<void> {
    setServerError(null);
    try {
      await authApi.forgotPassword(values.email);
      onSent(values.email);
    } catch (err) {
      setServerError(extractErrorMessage(err));
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
      <p className="text-sm text-slate-600">Enter your account email and we&apos;ll send you a 6-digit code.</p>
      <Field label="Email" error={errors.email?.message}>
        <input type="email" className={inputClass} {...register("email")} />
      </Field>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <button type="submit" disabled={isSubmitting} className={`${buttonClass} w-full`}>
        {isSubmitting ? "Sending..." : "Send code"}
      </button>
    </form>
  );
}

function EnterCodeStep({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>({ resolver: zodResolver(resetSchema) });

  async function onSubmit(values: ResetFormValues): Promise<void> {
    setServerError(null);
    try {
      await authApi.resetPassword(email, values.code, values.newPassword);
      navigate("/login", { state: { notice: "Password updated. Log in with your new password." } });
    } catch (err) {
      setServerError(extractErrorMessage(err));
    }
  }

  async function resend(): Promise<void> {
    setServerError(null);
    try {
      await authApi.forgotPassword(email);
      setResendNotice("If you haven't had a code in the last minute, a new one is on its way.");
    } catch (err) {
      setServerError(extractErrorMessage(err));
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
      <p className="text-sm text-slate-600">
        If an account exists for <span className="font-medium text-slate-900">{email}</span>, we sent it a code.
        It expires in 15 minutes.{" "}
        <button type="button" onClick={onChangeEmail} className="text-link hover:underline">
          Use a different email
        </button>
      </p>
      <Field label="6-digit code" error={errors.code?.message}>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          className={`${inputClass} tracking-[0.3em]`}
          {...register("code")}
        />
      </Field>
      <Field label="New password" error={errors.newPassword?.message}>
        <input type="password" autoComplete="new-password" className={inputClass} {...register("newPassword")} />
      </Field>
      <Field label="Confirm new password" error={errors.confirmPassword?.message}>
        <input type="password" autoComplete="new-password" className={inputClass} {...register("confirmPassword")} />
      </Field>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      {resendNotice && <p className="text-sm text-slate-600">{resendNotice}</p>}
      <button type="submit" disabled={isSubmitting} className={`${buttonClass} w-full`}>
        {isSubmitting ? "Resetting..." : "Reset password"}
      </button>
      <button type="button" onClick={() => void resend()} className="text-sm text-link hover:underline">
        Resend code
      </button>
    </form>
  );
}
