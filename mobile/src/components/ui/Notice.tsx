import { StyleSheet, Text } from "react-native";
import { radius, type Colors } from "./theme";
import { useThemedStyles } from "../../context/ThemeContext";

type Tone = "error" | "success" | "info";

export function Notice({ tone, children }: { tone: Tone; children: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Text accessibilityLiveRegion="polite" style={[styles.base, styles[tone]]}>
      {children}
    </Text>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    base: { fontSize: 14 },
    error: { color: colors.danger },
    info: { color: colors.textMuted },
    success: {
      color: colors.successText,
      backgroundColor: colors.successBg,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      paddingVertical: 8,
      overflow: "hidden",
    },
  });
