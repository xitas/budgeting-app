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
import { cancelEmailChange, confirmEmailChange, requestEmailChange } from "../../../features/account/api";
import { extractErrorMessage } from "../../../lib/errors";

const requestSchema = z.object({
  newEmail: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from the email") });

// Step 1: new address + password (a code goes to the new address).
// Step 2: the code confirms the change.
export default function ChangeEmailScreen() {
  const styles = useThemedStyles(makeStyles);
  const { user, setUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const request = useForm<z.infer<typeof requestSchema>>({ resolver: zodResolver(requestSchema) });
  const confirm = useForm<z.infer<typeof codeSchema>>({ resolver: zodResolver(codeSchema) });

  if (!user) return null;

  async function attempt(action: () => Promise<void>): Promise<void> {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <FormScreen>
      <Text style={styles.current}>
        Current email: <Text style={styles.strong}>{user.email}</Text>
      </Text>
      {user.pendingEmail ? (
        <>
          <Text style={styles.intro}>
            Enter the 6-digit code we sent to <Text style={styles.strong}>{user.pendingEmail}</Text> to finish the change.
          </Text>
          <FormField
            control={confirm.control}
            name="code"
            label="6-digit code"
            error={confirm.formState.errors.code?.message}
            keyboardType="number-pad"
            maxLength={6}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
          />
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button
            title={confirm.formState.isSubmitting ? "Confirming..." : "Confirm new email"}
            disabled={confirm.formState.isSubmitting}
            onPress={() =>
              void confirm.handleSubmit((values) =>
                attempt(async () => {
                  setUser(await confirmEmailChange(values.code));
                  router.back();
                })
              )()
            }
          />
          <Button
            title="Cancel the change"
            variant="ghost"
            onPress={() =>
              void attempt(async () => {
                setUser(await cancelEmailChange());
              })
            }
          />
        </>
      ) : (
        <>
          <FormField
            control={request.control}
            name="newEmail"
            label="New email"
            error={request.formState.errors.newEmail?.message}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <FormField
            control={request.control}
            name="password"
            label="Current password"
            error={request.formState.errors.password?.message}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
          />
          {error ? <Notice tone="error">{error}</Notice> : null}
          {notice ? <Notice tone="success">{notice}</Notice> : null}
          <Button
            title={request.formState.isSubmitting ? "Sending..." : "Send confirmation code"}
            disabled={request.formState.isSubmitting}
            onPress={() =>
              void request.handleSubmit((values) =>
                attempt(async () => {
                  const res = await requestEmailChange(values.newEmail, values.password);
                  setUser(res.user);
                  setNotice(res.message);
                })
              )()
            }
          />
        </>
      )}
    </FormScreen>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    current: { fontSize: 14, color: colors.textMuted },
    intro: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
    strong: { fontWeight: "600", color: colors.text },
  });
