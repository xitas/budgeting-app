import { StyleSheet, Text, View } from "react-native";
import type { CategorySpending } from "shared";
import { colors } from "../ui/theme";
import { ChartCard, DataTable } from "./ChartCard";
import { formatAmount } from "./chartUtils";

const BAR_THICKNESS = 14;

function percentOf(value: number, max: number): number {
  return max > 0 ? (value / max) * 100 : 0;
}

// Horizontal bars, largest first (the server already folds anything past the
// top 7 into "Other"). One series — spend — so no legend: the category name
// beside each bar carries identity, and each bar's value sits at its tip.
export function SpendingByCategoryChart({ data }: { data: CategorySpending[] }) {
  const total = data.reduce((sum, row) => sum + row.amount, 0);
  const max = Math.max(...data.map((row) => row.amount), 0);

  return (
    <ChartCard
      title="Spending by category"
      tableView={
        <DataTable
          headers={["Category", "Spent", "Share"]}
          rows={data.map((row) => [row.name, formatAmount(row.amount), `${total ? Math.round((row.amount / total) * 100) : 0}%`])}
        />
      }
    >
      {data.length === 0 ? (
        <Text style={styles.empty}>No spending this month.</Text>
      ) : (
        <View style={styles.rows}>
          {data.map((row) => (
            <View
              key={row.categoryId}
              style={styles.row}
              accessible
              accessibilityLabel={`${row.name}: ${formatAmount(row.amount)}`}
            >
              <View style={styles.labelRow}>
                <View style={[styles.dot, { backgroundColor: row.color }]} />
                <Text style={styles.label} numberOfLines={1}>
                  {row.name}
                </Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.bar, { width: `${percentOf(row.amount, max)}%`, backgroundColor: row.color }]} />
                <Text style={[styles.value, { left: `${percentOf(row.amount, max)}%` }]}>{formatAmount(row.amount)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ChartCard>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 14, color: colors.textSubtle },
  rows: { gap: 12 },
  row: { gap: 4 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 13, color: colors.textMuted, flex: 1 },
  // The track is the row minus room for the tip label, so bars share one
  // scale and even the longest bar leaves its value visible past its end.
  track: { height: BAR_THICKNESS, marginRight: 72, overflow: "visible", justifyContent: "center" },
  bar: {
    height: BAR_THICKNESS,
    minWidth: 2,
    // Rounded at the data end, square at the baseline.
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  // Value at the bar tip, in text ink (never the series color).
  value: { position: "absolute", marginLeft: 6, fontSize: 13, color: colors.text, fontVariant: ["tabular-nums"] },
});
