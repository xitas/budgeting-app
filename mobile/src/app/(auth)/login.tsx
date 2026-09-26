import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { AuthScreenLayout } from "../../components/ui/AuthScreenLayout";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Notice } from "../../components/ui/Notice";
import { TextLink } from "../../components/ui/TextLink";
import { type Colors } from "../../components/ui/theme";
import { useAuth } from "../../context/AuthContext";
import { extractErrorMessage } from "../../lib/errors";
import { useThemedStyles } from "../../context/ThemeContext";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const styles = useThemedStyles(makeStyles);
  const { login } = useAuth();
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginFormValues): Promise<void> {
    setServerError(null);
    try {
      // No navigation needed: the root layout's guards switch to (app) once
      // the user is set.
      await login(values.email, values.password);
    } catch (err) {
      setServerError(extractErrorMessage(err));
    }
  }

  return (
    <AuthScreenLayout title="Log in">
      {notice ? <Notice tone="success">{notice}</Notice> : null}
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
      <FormField
        control={control}
        name="password"
        label="Password"
        error={errors.password?.message}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void handleSubmit(onSubmit)()}
      />
      <TextLink title="Forgot password?" onPress={() => router.push("/forgot-password")} />
      {serverError ? <Notice tone="error">{serverError}</Notice> : null}
      <Button
        title={isSubmitting ? "Logging in..." : "Log in"}
        disabled={isSubmitting}
        onPress={() => void handleSubmit(onSubmit)()}
      />
      <View style={styles.footer}>
        <Text style={styles.footerText}>Don&apos;t have an account?</Text>
        <TextLink title="Sign up" onPress={() => router.push("/signup")} />
      </View>
    </AuthScreenLayout>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    footer: { flexDirection: "row", alignItems: "center", gap: 6 },
    footerText: { fontSize: 14, color: colors.textMuted },
  });
