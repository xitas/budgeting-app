import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { AuthFormLayout } from "../components/ui/AuthFormLayout";
import { Field } from "../components/ui/Field";
import { buttonClass, inputClass } from "../components/ui/formStyles";
import { useAuth } from "../context/AuthContext";
import { extractErrorMessage } from "../lib/errors";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login, signedOutNotice } = useAuth();
  const navigate = useNavigate();
  const notice = (useLocation().state as { notice?: string } | null)?.notice ?? signedOutNotice;
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginFormValues): Promise<void> {
    setServerError(null);
    try {
      await login(values.email, values.password);
      navigate("/");
    } catch (err) {
      setServerError(extractErrorMessage(err));
    }
  }

  return (
    <AuthFormLayout title="Log in">
      {notice && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>
      )}
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
        <Field label="Email" error={errors.email?.message}>
          <input type="email" className={inputClass} {...register("email")} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <input type="password" className={inputClass} {...register("password")} />
        </Field>
        <Link to="/forgot-password" className="block text-sm text-link hover:underline">
          Forgot password?
        </Link>
        {serverError && <p className="text-sm text-red-600">{serverError}</p>}
        <button type="submit" disabled={isSubmitting} className={`${buttonClass} w-full`}>
          {isSubmitting ? "Logging in..." : "Log in"}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Don&apos;t have an account?{" "}
        <Link to="/signup" className="text-link hover:underline">
          Sign up
        </Link>
      </p>
    </AuthFormLayout>
  );
}
