import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../ui/theme";

export type Tone = "positive" | "negative" | "neutral";

const TONE_COLOR: Record<Tone, string> = {
  positive: colors.positive,
  negative: colors.danger,
  neutral: colors.text,
};

export function StatTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: Tone }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: TONE_COLOR[tone] }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
