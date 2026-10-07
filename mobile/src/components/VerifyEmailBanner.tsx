import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { useThemedStyles } from "../context/ThemeContext";
import * as authApi from "../features/auth/api";
import { extractErrorMessage } from "../lib/errors";
import { type Colors } from "./ui/theme";

// Sits above the tabs until the email is verified. It takes the status-bar
// inset itself, so the tab headers drop theirs while it shows.
export function VerifyEmailBanner() {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [status, setStatus] = useState<string | null>(null);

  if (!user || user.emailVerified) return null;

  async function resend(): Promise<void> {
    if (!user) return;
    try {
      await authApi.resendVerification(user.email);
      setStatus("Code sent — check your inbox.");
    } catch (err) {
      setStatus(extractErrorMessage(err));
    }
  }

  return (
    <View style={[styles.banner, { paddingTop: insets.top + 8 }]} accessibilityRole="summary">
      <Text style={styles.text}>Please verify your email ({user.email}).</Text>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push("/account/verify-email")}>
          <Text style={styles.action}>Enter code</Text>
        </Pressable>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void resend()}>
          <Text style={styles.action}>Resend code</Text>
        </Pressable>
      </View>
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

export function useShowsVerifyBanner(): boolean {
  const { user } = useAuth();
  return !!user && !user.emailVerified;
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    banner: {
      backgroundColor: colors.noticeBg,
      borderBottomWidth: 1,
      borderBottomColor: colors.noticeBorder,
      paddingHorizontal: 16,
      paddingBottom: 10,
      gap: 6,
    },
    text: { fontSize: 14, color: colors.noticeText },
    actions: { flexDirection: "row", gap: 20 },
    action: { fontSize: 14, fontWeight: "600", color: colors.noticeText, textDecorationLine: "underline" },
    status: { fontSize: 13, color: colors.noticeText },
  });
