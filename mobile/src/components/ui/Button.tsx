import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius } from "./theme";

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
}

export function Button({ title, onPress, disabled, variant = "primary" }: ButtonProps) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.ghost,
        pressed && (isPrimary ? styles.primaryPressed : styles.ghostPressed),
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, isPrimary ? styles.primaryLabel : styles.ghostLabel]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  primary: { backgroundColor: colors.primary },
  primaryPressed: { backgroundColor: colors.primaryPressed },
  ghost: { borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.surface },
  ghostPressed: { backgroundColor: colors.border },
  disabled: { opacity: 0.5 },
  label: { fontSize: 15, fontWeight: "600" },
  primaryLabel: { color: "#ffffff" },
  ghostLabel: { color: colors.text },
});
