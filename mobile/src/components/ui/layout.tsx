import type { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { radius, type Colors } from "./theme";
import { useColors, useThemedStyles } from "../../context/ThemeContext";

// Scrollable form screen body (used by every add/edit modal).
export function FormScreen({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const styles = useThemedStyles(makeStyles);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CenteredMessage({ children, loading }: { children?: string; loading?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  return (
    <View style={styles.centered}>
      {loading ? <ActivityIndicator color={colors.link} /> : null}
      {children ? <Text style={styles.message}>{children}</Text> : null}
    </View>
  );
}

const FAB_SIZE = 56;
const FAB_OFFSET = 20;

// Bottom padding for a list under a Fab, so its last row scrolls fully clear
// of the button (button height + its offset + a gap).
export const FAB_CLEARANCE = FAB_OFFSET + FAB_SIZE + 16;

// Round "+" in the bottom-right corner of list screens.
export function Fab({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
    >
      <Text style={styles.fabIcon}>+</Text>
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: string }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    form: { padding: 16, gap: 16, paddingBottom: 40 },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: 16,
    },
    centered: { padding: 24, alignItems: "center", gap: 8 },
    message: { fontSize: 14, color: colors.textSubtle, textAlign: "center" },
    fab: {
      position: "absolute",
      right: FAB_OFFSET,
      bottom: FAB_OFFSET,
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: FAB_SIZE / 2,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      elevation: 4,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    },
    fabPressed: { backgroundColor: colors.primaryPressed },
    fabIcon: { color: colors.onPrimary, fontSize: 30, lineHeight: 32, fontWeight: "400" },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSubtle,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
  });
