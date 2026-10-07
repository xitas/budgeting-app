import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { StyleSheet, Text } from "react-native";
import { z } from "zod";
import { Button } from "../../../components/ui/Button";
import { FormField } from "../../../components/ui/FormField";
import { FormScreen } from "../../../components/ui/layout";
import { Notice } from "../../../components/ui/Notice";
import { type Colors } from "../../../components/ui/theme";
import { useAuth } from "../../../context/AuthContext";
import { useThemedStyles } from "../../../context/ThemeContext";
import { changePassword } from "../../../features/account/api";
import { extractErrorMessage } from "../../../lib/errors";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });
type Values = z.infer<typeof schema>;

export default function ChangePasswordScreen() {
  const styles = useThemedStyles(makeStyles);
  const { applyAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values): Promise<void> {
    setError(null);
    try {
      // New tokens for this device; the others are signed out.
      await applyAuth(await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }));
      router.back();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <FormScreen>
      <Text style={styles.intro}>Changing your password signs you out on your other devices.</Text>
      <FormField control={control} name="currentPassword" label="Current password" error={errors.currentPassword?.message} secureTextEntry autoComplete="current-password" textContentType="password" />
      <FormField control={control} name="newPassword" label="New password" error={errors.newPassword?.message} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
      <FormField control={control} name="confirmPassword" label="Confirm new password" error={errors.confirmPassword?.message} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button title={isSubmitting ? "Changing..." : "Change password"} disabled={isSubmitting} onPress={() => void handleSubmit(onSubmit)()} />
    </FormScreen>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    intro: { fontSize: 14, color: colors.textMuted },
  });
