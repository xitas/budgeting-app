import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { AuthFormLayout } from "../components/ui/AuthFormLayout";
import { Field } from "../components/ui/Field";
import { buttonClass, inputClass } from "../components/ui/formStyles";
import { useAuth } from "../context/AuthContext";
import * as authApi from "../features/auth/api";
import { extractErrorMessage } from "../lib/errors";

const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from the email") });
type CodeFormValues = z.infer<typeof codeSchema>;

// After sign-up (signed out), or from the "verify your email" banner (signed
// in). The code verifies the address and signs in.
export function VerifyEmailPage() {
  const { user, verifyEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const email = (location.state as { email?: string } | null)?.email ?? params.get("email") ?? user?.email ?? "";
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CodeFormValues>({ resolver: zodResolver(codeSchema) });

  if (!email) return <Navigate to="/signup" replace />;
  if (user?.emailVerified && user.email === email) return <Navigate to="/" replace />;

  async function onSubmit(values: CodeFormValues): Promise<void> {
    setServerError(null);
    try {
      await verifyEmail(email, values.code);
      navigate("/", { replace: true });
    } catch (err) {
      setServerError(extractErrorMessage(err));
    }
  }

  async function resend(): Promise<void> {
    setServerError(null);
    try {
      await authApi.resendVerification(email);
      setNotice("If you haven't had a code in the last minute, a new one is on its way.");
    } catch (err) {
      setServerError(extractErrorMessage(err));
    }
  }

  return (
    <AuthFormLayout title="Verify your email">
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
        <p className="text-sm text-slate-600">
          We sent a 6-digit code to <span className="font-medium text-slate-900">{email}</span>. It expires in 15
          minutes. (If you already had an account with this address, we emailed you about that instead — just log in.)
        </p>
        <Field label="6-digit code" error={errors.code?.message}>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            className={`${inputClass} tracking-[0.3em]`}
            {...register("code")}
          />
        </Field>
        {serverError && <p className="text-sm text-red-600">{serverError}</p>}
        {notice && <p className="text-sm text-slate-600">{notice}</p>}
        <button type="submit" disabled={isSubmitting} className={`${buttonClass} w-full`}>
          {isSubmitting ? "Verifying..." : "Verify and continue"}
        </button>
        <button type="button" onClick={() => void resend()} className="text-sm text-link hover:underline">
          Resend code
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        {user ? (
          <Link to="/" className="text-link hover:underline">
            Do this later
          </Link>
        ) : (
          <>
            Do it later?{" "}
            <Link to="/login" className="text-link hover:underline">
              Log in
            </Link>{" "}
            — you can verify from the app.
          </>
        )}
      </p>
    </AuthFormLayout>
  );
}
