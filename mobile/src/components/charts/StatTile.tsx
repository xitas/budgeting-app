import { StyleSheet, Text, View } from "react-native";
import { radius, type Colors } from "../ui/theme";
import { useColors, useThemedStyles } from "../../context/ThemeContext";

export type Tone = "positive" | "negative" | "neutral";

export function StatTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: Tone }) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const toneColor = { positive: colors.positive, negative: colors.danger, neutral: colors.text }[tone];
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: toneColor }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    tile: {
      flexBasis: "47%",
      flexGrow: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: 14,
    },
    label: { fontSize: 13, color: colors.textSubtle },
    value: { fontSize: 22, fontWeight: "600", marginTop: 4 },
  });
