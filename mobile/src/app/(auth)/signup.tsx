import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
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

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupScreen() {
  const styles = useThemedStyles(makeStyles);
  const { signup } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(values: SignupFormValues): Promise<void> {
    setServerError(null);
    try {
      await signup(values.email, values.password, values.name);
    } catch (err) {
      setServerError(extractErrorMessage(err));
    }
  }

  return (
    <AuthScreenLayout title="Create account">
      <FormField control={control} name="name" label="Name" error={errors.name?.message} autoComplete="name" />
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
        autoComplete="new-password"
        textContentType="newPassword"
      />
      {serverError ? <Notice tone="error">{serverError}</Notice> : null}
      <Button
        title={isSubmitting ? "Creating account..." : "Sign up"}
        disabled={isSubmitting}
        onPress={() => void handleSubmit(onSubmit)()}
      />
      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <TextLink title="Log in" onPress={() => router.back()} />
      </View>
    </AuthScreenLayout>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    footer: { flexDirection: "row", alignItems: "center", gap: 6 },
    footerText: { fontSize: 14, color: colors.textMuted },
  });
