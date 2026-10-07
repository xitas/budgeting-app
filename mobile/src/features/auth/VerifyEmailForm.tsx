import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { StyleSheet, Text } from "react-native";
import { z } from "zod";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Notice } from "../../components/ui/Notice";
import { TextLink } from "../../components/ui/TextLink";
import { type Colors } from "../../components/ui/theme";
import { useAuth } from "../../context/AuthContext";
import { useThemedStyles } from "../../context/ThemeContext";
import { extractErrorMessage } from "../../lib/errors";
import * as authApi from "./api";

const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from the email") });
type CodeFormValues = z.infer<typeof codeSchema>;

// Used right after sign-up (signed out) and from the "verify your email"
// banner (signed in). A correct code verifies the address and signs in.
export function VerifyEmailForm({ email, onVerified }: { email: string; onVerified?: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const { verifyEmail } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CodeFormValues>({ resolver: zodResolver(codeSchema) });

  async function onSubmit(values: CodeFormValues): Promise<void> {
    setServerError(null);
    try {
      await verifyEmail(email, values.code);
      onVerified?.();
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
    <>
      <Text style={styles.intro}>
        We sent a 6-digit code to <Text style={styles.email}>{email}</Text>. It expires in 15 minutes. (If you already had an account with this
        address, we emailed you about that instead — just log in.)
      </Text>
      <FormField
        control={control}
        name="code"
        label="6-digit code"
        error={errors.code?.message}
        keyboardType="number-pad"
        maxLength={6}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
      />
      {serverError ? <Notice tone="error">{serverError}</Notice> : null}
      {notice ? <Notice tone="info">{notice}</Notice> : null}
      <Button title={isSubmitting ? "Verifying..." : "Verify and continue"} disabled={isSubmitting} onPress={() => void handleSubmit(onSubmit)()} />
      <TextLink title="Resend code" onPress={() => void resend()} />
    </>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    intro: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
    email: { fontWeight: "600", color: colors.text },
  });
