import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { StyleSheet, Text } from "react-native";
import { z } from "zod";
import { Button } from "../../../components/ui/Button";
import { FormField } from "../../../components/ui/FormField";
import { FormScreen } from "../../../components/ui/layout";
import { Notice } from "../../../components/ui/Notice";
import { radius, type Colors } from "../../../components/ui/theme";
import { useAuth } from "../../../context/AuthContext";
import { useThemedStyles } from "../../../context/ThemeContext";
import { deleteAccount, fetchBackup } from "../../../features/account/api";
import { confirmDestructive } from "../../../lib/confirm";
import { todayIso } from "../../../lib/dates";
import { extractErrorMessage } from "../../../lib/errors";
import { shareJson } from "../../../lib/shareFile";

const schema = z.object({ password: z.string().min(1, "Enter your password") });

export default function DeleteAccountScreen() {
  const styles = useThemedStyles(makeStyles);
  const { user, signOutLocally } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  async function exportFirst(): Promise<void> {
    setError(null);
    try {
      await shareJson(`budget-backup-${todayIso()}.json`, JSON.stringify(await fetchBackup(), null, 2), "Save your backup");
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function onSubmit({ password }: { password: string }): Promise<void> {
    setError(null);
    if (!(await confirmDestructive("Delete your account?", "Everything is deleted permanently and you're signed out everywhere.", "Delete forever"))) return;
    try {
      await deleteAccount(password);
      await signOutLocally(); // the guard returns to the login screen
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <FormScreen>
      <Text style={styles.warning}>
        This permanently deletes {user?.email} and every transaction, category, budget, recurring rule and loan in it, and signs you out on all
        devices. It can&apos;t be undone.
      </Text>
      <Button title="Download my data first" variant="ghost" onPress={() => void exportFirst()} />
      <FormField control={control} name="password" label="Password" error={errors.password?.message} secureTextEntry autoComplete="current-password" textContentType="password" />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button title={isSubmitting ? "Deleting..." : "Delete my account"} disabled={isSubmitting} onPress={() => void handleSubmit(onSubmit)()} />
    </FormScreen>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    warning: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.danger,
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: radius.md,
      padding: 12,
    },
  });
