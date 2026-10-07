import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { CURRENCIES, formatMoney, type BackupPreviewResponse, type CurrencyCode } from "shared";
import { Button } from "../../components/ui/Button";
import { Card, SectionTitle } from "../../components/ui/layout";
import { Notice } from "../../components/ui/Notice";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { radius, type Colors } from "../../components/ui/theme";
import { useAuth } from "../../context/AuthContext";
import { useColors, useTheme, useThemedStyles, type ThemeMode } from "../../context/ThemeContext";
import { fetchBackup, importBackup, previewBackup, signOutEverywhere, updateProfile } from "../../features/account/api";
import * as authApi from "../../features/auth/api";
import { confirmDestructive } from "../../lib/confirm";
import { formatDisplayDate, todayIso } from "../../lib/dates";
import { extractErrorMessage } from "../../lib/errors";
import { pickTextFile } from "../../lib/pickFile";
import { shareJson } from "../../lib/shareFile";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

type Status = { tone: "error" | "success"; text: string } | null;

export default function SettingsScreen() {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const queryClient = useQueryClient();
  const { user, setUser, signOutLocally } = useAuth();
  const { mode, setMode } = useTheme();
  const [name, setName] = useState(user?.name ?? "");
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [restore, setRestore] = useState<{ name: string; data: unknown; preview: BackupPreviewResponse } | null>(null);

  if (!user) return null;

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setStatus(null);
    try {
      await action();
    } catch (err) {
      setStatus({ tone: "error", text: extractErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function pickBackup(): Promise<void> {
    const file = await pickTextFile(["application/json", "text/plain", "*/*"]);
    if (!file) return;
    let data: unknown;
    try {
      data = JSON.parse(file.text);
    } catch {
      throw new Error("That file isn't a backup (it isn't valid JSON).");
    }
    setRestore({ name: file.name, data, preview: await previewBackup(data) });
  }

  async function doRestore(): Promise<void> {
    if (!restore) return;
    const { accountHasData } = restore.preview;
    if (
      accountHasData &&
      !(await confirmDestructive(
        "Replace all your data?",
        "Every transaction, category, budget, recurring rule and loan in this account is deleted and replaced by the backup. This can't be undone.",
        "Replace"
      ))
    ) {
      return;
    }
    const { summary } = await importBackup(restore.data, accountHasData);
    setUser((await authApi.me()).user);
    await queryClient.invalidateQueries();
    setRestore(null);
    setStatus({ tone: "success", text: `Restored ${summary.counts.transactions} transactions, ${summary.counts.categories} categories and the rest of the backup.` });
  }

  const rows: { label: string; detail: string; href: Href }[] = [
    {
      label: "Email",
      detail: user.pendingEmail ? `${user.email} → ${user.pendingEmail} (waiting for code)` : `${user.email}${user.emailVerified ? "" : " · not verified"}`,
      href: "/account/email",
    },
    { label: "Password", detail: "Change your password", href: "/account/password" },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {status ? <Notice tone={status.tone}>{status.text}</Notice> : null}

      <SectionTitle>Profile</SectionTitle>
      <Card style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          accessibilityLabel="Name"
          value={name}
          onChangeText={setName}
          autoComplete="name"
          placeholderTextColor={colors.textSubtle}
          style={styles.input}
        />
        <Button
          title="Save name"
          variant="ghost"
          disabled={busy || !name.trim() || name.trim() === user.name}
          onPress={() =>
            void run(async () => {
              setUser(await updateProfile({ name: name.trim() }));
              setStatus({ tone: "success", text: "Name saved." });
            })
          }
        />
      </Card>

      <SectionTitle>Currency</SectionTitle>
      <Card style={styles.listCard}>
        {CURRENCIES.map((c, i) => {
          const selected = user.currency === c.code;
          return (
            <Pressable
              key={c.code}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() =>
                void run(async () => {
                  setUser(await updateProfile({ currency: c.code as CurrencyCode }));
                })
              }
              style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.rowPressed]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>
                  {c.code} — {c.name}
                </Text>
                <Text style={styles.rowDetail}>{formatMoney(125050, { currency: c.code, grouping: true })}</Text>
              </View>
              {selected ? <Ionicons name="checkmark" size={20} color={colors.link} /> : null}
            </Pressable>
          );
        })}
      </Card>
      <Text style={styles.hint}>Changes how amounts are shown; the numbers themselves don&apos;t change.</Text>

      <SectionTitle>Appearance</SectionTitle>
      <SegmentedControl options={THEME_OPTIONS} value={mode} onChange={setMode} />

      <SectionTitle>Sign-in</SectionTitle>
      <Card style={styles.listCard}>
        {rows.map((row, i) => (
          <Pressable
            key={row.label}
            accessibilityRole="button"
            onPress={() => router.push(row.href)}
            style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.rowPressed]}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowDetail}>{row.detail}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </Pressable>
        ))}
      </Card>

      <SectionTitle>Your data</SectionTitle>
      <Card style={styles.card}>
        <Text style={styles.hint}>A backup is one JSON file with everything: transactions, categories, budgets, recurring rules, loans and settings.</Text>
        <Button
          title="Download backup"
          disabled={busy}
          onPress={() =>
            void run(async () => {
              const backup = await fetchBackup();
              await shareJson(`budget-backup-${todayIso()}.json`, JSON.stringify(backup, null, 2), "Save your backup");
            })
          }
        />
        <Button title="Restore from backup…" variant="ghost" disabled={busy} onPress={() => void run(pickBackup)} />
        {restore ? (
          <View style={styles.restore}>
            <Text style={styles.rowLabel}>{restore.name}</Text>
            <Text style={styles.rowDetail}>
              Backup from {formatDisplayDate(restore.preview.summary.exportedAt)} · {restore.preview.summary.currency}
            </Text>
            <Text style={styles.rowDetail}>
              {restore.preview.summary.counts.transactions} transactions · {restore.preview.summary.counts.categories} categories ·{" "}
              {restore.preview.summary.counts.budgets} budgets · {restore.preview.summary.counts.recurring} recurring rules ·{" "}
              {restore.preview.summary.counts.loans} loans ({restore.preview.summary.counts.repayments} repayments)
            </Text>
            <Text style={restore.preview.accountHasData ? styles.warning : styles.rowDetail}>
              {restore.preview.accountHasData
                ? "This replaces all of your current data. Download a backup first if you might need it."
                : "This account has no data of its own yet, so the backup simply fills it."}
            </Text>
            <Button title={restore.preview.accountHasData ? "Replace my data with this backup" : "Restore this backup"} disabled={busy} onPress={() => void run(doRestore)} />
            <Button title="Cancel" variant="ghost" onPress={() => setRestore(null)} />
          </View>
        ) : null}
      </Card>

      <SectionTitle>Danger zone</SectionTitle>
      <Card style={styles.card}>
        <Text style={styles.hint}>Sign out ends every session, including this one, on the web and in the app.</Text>
        <Button
          title="Sign out of all devices"
          variant="ghost"
          disabled={busy}
          onPress={() =>
            void run(async () => {
              if (!(await confirmDestructive("Sign out everywhere?", "Every device, including this one, will need to log in again.", "Sign out"))) return;
              await signOutEverywhere();
              await signOutLocally();
            })
          }
        />
        <Button title="Delete account…" variant="ghost" onPress={() => router.push("/account/delete")} />
      </Card>
    </ScrollView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    container: { padding: 16, gap: 12, paddingBottom: 40 },
    card: { gap: 10 },
    listCard: { padding: 0 },
    label: { fontSize: 14, fontWeight: "500", color: colors.text },
    input: {
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
    rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    rowPressed: { backgroundColor: colors.background },
    rowText: { flex: 1, gap: 2 },
    rowLabel: { fontSize: 15, color: colors.text, fontWeight: "500" },
    rowDetail: { fontSize: 13, color: colors.textSubtle },
    hint: { fontSize: 13, color: colors.textSubtle },
    warning: { fontSize: 13, color: colors.danger, fontWeight: "600" },
    restore: { gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 10 },
  });
