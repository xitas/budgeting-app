import { Pressable, StyleSheet, Text, View } from "react-native";
import { type Colors } from "./theme";
import { useSchemeColor, useThemedStyles } from "../../context/ThemeContext";

interface PickableCategory {
  id: string;
  name: string;
  color: string;
}

interface CategoryPickerProps {
  label: string;
  categories: PickableCategory[];
  value: string | undefined;
  onChange: (id: string) => void;
  error?: string;
  allowAll?: boolean; // adds an "All" chip that selects "" (for filters)
  emptyText?: string;
}

// Wrapping chips instead of a dropdown: a user has a handful of categories,
// so showing them all is one tap faster than opening a picker.
export function CategoryPicker({ label, categories, value, onChange, error, allowAll, emptyText }: CategoryPickerProps) {
  const schemeColor = useSchemeColor();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View accessibilityRole="radiogroup" style={styles.chips}>
        {allowAll ? <Chip label="All" selected={!value} onPress={() => onChange("")} /> : null}
        {categories.map((c) => (
          <Chip key={c.id} label={c.name} color={schemeColor(c.color)} selected={value === c.id} onPress={() => onChange(c.id)} />
        ))}
        {categories.length === 0 && emptyText ? <Text style={styles.empty}>{emptyText}</Text> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function Chip({ label, color, selected, onPress }: { label: string; color?: string; selected: boolean; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    wrapper: { gap: 6 },
    label: { fontSize: 14, fontWeight: "500", color: colors.text },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: colors.surface,
    },
    chipSelected: { borderColor: colors.link, backgroundColor: colors.selectedBg },
    dot: { width: 10, height: 10, borderRadius: 5 },
    chipLabel: { fontSize: 14, color: colors.text },
    chipLabelSelected: { color: colors.selectedText, fontWeight: "600" },
    empty: { fontSize: 14, color: colors.textSubtle },
    error: { fontSize: 13, color: colors.danger },
  });
