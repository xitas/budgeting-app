import { StyleSheet, Text } from "react-native";
import { colors, radius } from "./theme";

type Tone = "error" | "success" | "info";

export function Notice({ tone, children }: { tone: Tone; children: string }) {
  return (
    <Text accessibilityLiveRegion="polite" style={[styles.base, styles[tone]]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
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
