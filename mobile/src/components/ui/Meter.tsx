import { StyleSheet, View } from "react-native";

interface MeterProps {
  value: number;
  max: number;
  color: string;
  overColor?: string; // fill color once value exceeds max
}

// Progress meter: the unfilled track is a light wash of the fill's own hue
// (not a neutral gray), so the bar reads as one object at any fill level.
// Callers always pair it with a text label — color never carries state alone.
export function Meter({ value, max, color, overColor }: MeterProps) {
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  const fill = overColor && value > max ? overColor : color;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
      style={[styles.track, { backgroundColor: `${fill}26` }]}
    >
      <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: fill }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
});
