import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { AuthFormLayout } from "../components/ui/AuthFormLayout";
import { Field } from "../components/ui/Field";
import { buttonClass, inputClass } from "../components/ui/formStyles";
import { useAuth } from "../context/AuthContext";
import { extractErrorMessage } from "../lib/errors";

const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(values: SignupFormValues): Promise<void> {
    setServerError(null);
    try {
      await signup(values.email, values.password, values.name);
      navigate("/");
    } catch (err) {
      setServerError(extractErrorMessage(err));
    }
  }

  return (
    <AuthFormLayout title="Create your account">
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
        <Field label="Name" error={errors.name?.message}>
          <input type="text" className={inputClass} {...register("name")} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <input type="email" className={inputClass} {...register("email")} />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <input type="password" className={inputClass} {...register("password")} />
        </Field>
        {serverError && <p className="text-sm text-red-600">{serverError}</p>}
        <button type="submit" disabled={isSubmitting} className={`${buttonClass} w-full`}>
          {isSubmitting ? "Creating account..." : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Already have an account?{" "}
        <Link to="/login" className="text-blue-600 hover:underline">
          Log in
        </Link>
      </p>
    </AuthFormLayout>
  );
}
