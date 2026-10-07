import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { AuthScreenLayout } from "../../components/ui/AuthScreenLayout";
import { TextLink } from "../../components/ui/TextLink";
import { type Colors } from "../../components/ui/theme";
import { useThemedStyles } from "../../context/ThemeContext";
import { VerifyEmailForm } from "../../features/auth/VerifyEmailForm";

// Right after sign-up. Verifying signs in (the auth guard then swaps to the app).
export default function VerifyEmailScreen() {
  const styles = useThemedStyles(makeStyles);
  const { email } = useLocalSearchParams<{ email: string }>();
  return (
    <AuthScreenLayout title="Verify your email">
      <VerifyEmailForm email={email ?? ""} />
      <View style={styles.footer}>
        <Text style={styles.footerText}>Do it later?</Text>
        <TextLink title="Log in" onPress={() => router.replace("/login")} />
      </View>
    </AuthScreenLayout>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    footer: { flexDirection: "row", alignItems: "center", gap: 6 },
    footerText: { fontSize: 14, color: colors.textMuted },
  });
