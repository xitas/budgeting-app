import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MONTH_NAMES, shiftMonth } from "../../lib/dates";
import { colors } from "./theme";

interface MonthSwitcherProps {
  month: number;
  year: number;
  onChange: (next: { month: number; year: number }) => void;
}

export function MonthSwitcher({ month, year, onChange }: MonthSwitcherProps) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        hitSlop={12}
        onPress={() => onChange(shiftMonth(month, year, -1))}
      >
        <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
      </Pressable>
      <Text style={styles.label}>
        {MONTH_NAMES[month - 1]} {year}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next month"
        hitSlop={12}
        onPress={() => onChange(shiftMonth(month, year, 1))}
      >
        <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  label: { fontSize: 16, fontWeight: "600", color: colors.text, minWidth: 150, textAlign: "center" },
});
