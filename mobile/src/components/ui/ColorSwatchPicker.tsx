import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CATEGORICAL_PALETTE } from "shared";
import { type Colors } from "./theme";
import { useSchemeColor, useThemedStyles } from "../../context/ThemeContext";

const SWATCH_NAMES = ["Blue", "Orange", "Aqua", "Yellow", "Magenta", "Green", "Violet", "Red"];

interface ColorSwatchPickerProps {
  label: string;
  value: string | undefined;
  onChange: (hex: string) => void;
  error?: string;
}

// The validated categorical palette only (no free-form picker on mobile), so
// every category color stays distinguishable in the charts.
export function ColorSwatchPicker({ label, value, onChange, error }: ColorSwatchPickerProps) {
  const styles = useThemedStyles(makeStyles);
  // Shown in the current scheme's step; the stored value stays the light hex.
  const schemeColor = useSchemeColor();
  const isCustom = value !== undefined && !CATEGORICAL_PALETTE.some((hex) => hex.toLowerCase() === value.toLowerCase());
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View accessibilityRole="radiogroup" style={styles.row}>
        {CATEGORICAL_PALETTE.map((hex, i) => {
          const selected = value?.toLowerCase() === hex.toLowerCase();
          return (
            <Pressable
              key={hex}
              accessibilityRole="radio"
              accessibilityLabel={SWATCH_NAMES[i]}
              accessibilityState={{ selected }}
              onPress={() => onChange(hex)}
              style={[styles.swatch, { backgroundColor: schemeColor(hex) }, selected && styles.swatchSelected]}
            >
              {selected ? <Ionicons name="checkmark" size={18} color="#ffffff" /> : null}
            </Pressable>
          );
        })}
      </View>
      {isCustom ? <Text style={styles.hint}>Current color {value} was set on the web; pick a swatch to change it.</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    wrapper: { gap: 6 },
    label: { fontSize: 14, fontWeight: "500", color: colors.text },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    swatch: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    swatchSelected: { borderWidth: 3, borderColor: colors.text },
    hint: { fontSize: 13, color: colors.textSubtle },
    error: { fontSize: 13, color: colors.danger },
  });
