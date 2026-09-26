import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { StyleSheet, Text } from "react-native";
import { z } from "zod";
import { AuthScreenLayout } from "../../components/ui/AuthScreenLayout";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Notice } from "../../components/ui/Notice";
import { TextLink } from "../../components/ui/TextLink";
import { colors } from "../../components/ui/theme";
import * as authApi from "../../features/auth/api";
import { extractErrorMessage } from "../../lib/errors";

const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
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

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState<string | null>(null);

  return (
    <AuthScreenLayout title="Reset password">
      {email === null ? (
        <RequestCodeStep onSent={setEmail} />
      ) : (
        <EnterCodeStep email={email} onChangeEmail={() => setEmail(null)} />
      )}
      <TextLink title="Back to log in" onPress={() => router.back()} />
    </AuthScreenLayout>
  );
}

function RequestCodeStep({ onSent }: { onSent: (email: string) => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    control,
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
    <>
      <Text style={styles.body}>Enter your account email and we&apos;ll send you a 6-digit code.</Text>
      <FormField
        control={control}
        name="email"
        label="Email"
        error={errors.email?.message}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      {serverError ? <Notice tone="error">{serverError}</Notice> : null}
      <Button
        title={isSubmitting ? "Sending..." : "Send code"}
        disabled={isSubmitting}
        onPress={() => void handleSubmit(onSubmit)()}
      />
    </>
  );
}

function EnterCodeStep({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>({ resolver: zodResolver(resetSchema) });

  async function onSubmit(values: ResetFormValues): Promise<void> {
    setServerError(null);
    try {
      await authApi.resetPassword(email, values.code, values.newPassword);
      router.replace({ pathname: "/login", params: { notice: "Password updated. Log in with your new password." } });
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
    <>
      <Text style={styles.body}>
        If an account exists for <Text style={styles.email}>{email}</Text>, we sent it a code. It expires in 15
        minutes.
      </Text>
      <TextLink title="Use a different email" onPress={onChangeEmail} />
      <FormField
        control={control}
        name="code"
        label="6-digit code"
        error={errors.code?.message}
        keyboardType="number-pad"
        maxLength={6}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        style={styles.codeInput}
      />
      <FormField
        control={control}
        name="newPassword"
        label="New password"
        error={errors.newPassword?.message}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <FormField
        control={control}
        name="confirmPassword"
        label="Confirm new password"
        error={errors.confirmPassword?.message}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      {serverError ? <Notice tone="error">{serverError}</Notice> : null}
      {resendNotice ? <Notice tone="info">{resendNotice}</Notice> : null}
      <Button
        title={isSubmitting ? "Resetting..." : "Reset password"}
        disabled={isSubmitting}
        onPress={() => void handleSubmit(onSubmit)()}
      />
      <TextLink title="Resend code" onPress={() => void resend()} />
    </>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  email: { fontWeight: "600", color: colors.text },
  codeInput: { letterSpacing: 6, fontSize: 18 },
});
