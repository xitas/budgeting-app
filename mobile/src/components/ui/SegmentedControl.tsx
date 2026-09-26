import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "./theme";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label?: string;
  options: Option<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
}

// Stands in for the web app's small <select>s (type, direction, frequency):
// every option visible, one tap to choose.
export function SegmentedControl<T extends string>({ label, options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View accessibilityRole="radiogroup" style={styles.track}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 4 },
  label: { fontSize: 14, fontWeight: "500", color: colors.text },
  track: {
    flexDirection: "row",
    backgroundColor: colors.border,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  segment: { flex: 1, paddingVertical: 8, borderRadius: radius.md - 2, alignItems: "center" },
  segmentSelected: { backgroundColor: colors.surface },
  segmentLabel: { fontSize: 14, color: colors.textMuted },
  segmentLabelSelected: { color: colors.text, fontWeight: "600" },
});
