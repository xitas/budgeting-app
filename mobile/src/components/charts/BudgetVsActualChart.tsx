import { StyleSheet, Text, View } from "react-native";
import type { BudgetVsActual } from "shared";
import { Meter } from "../ui/Meter";
import { type Colors } from "../ui/theme";
import { ChartCard, DataTable } from "./ChartCard";
import { formatAmount } from "./chartUtils";
import { useColors, useSchemeColor, useThemedStyles } from "../../context/ThemeContext";

// One meter per budget. Over-budget switches the fill to the reserved danger
// color AND says so in words ("Over by …"), so the state never rests on
// color alone.
export function BudgetVsActualChart({ data }: { data: BudgetVsActual[] }) {
  const schemeColor = useSchemeColor();
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  return (
    <ChartCard
      title="Budget vs actual"
      tableView={
        <DataTable
          headers={["Category", "Spent", "Limit", "Used"]}
          rows={data.map((b) => [
            b.category.name,
            formatAmount(b.spent),
            formatAmount(b.limit),
            `${b.limit ? Math.round((b.spent / b.limit) * 100) : 0}%`,
          ])}
        />
      }
    >
      {data.length === 0 ? (
        <Text style={styles.empty}>No budgets set for this month.</Text>
      ) : (
        <View style={styles.rows}>
          {data.map((b) => {
            const over = b.remaining < 0;
            return (
              <View key={b.id} style={styles.row}>
                <View style={styles.header}>
                  <View style={[styles.dot, { backgroundColor: schemeColor(b.category.color) }]} />
                  <Text style={styles.name} numberOfLines={1}>
                    {b.category.name}
                  </Text>
                  <Text style={styles.amounts}>
                    {formatAmount(b.spent)} / {formatAmount(b.limit)}
                  </Text>
                </View>
                <Meter value={b.spent} max={b.limit} color={schemeColor(b.category.color)} overColor={colors.danger} />
                {over ? <Text style={styles.over}>Over by {formatAmount(Math.abs(b.remaining))}</Text> : null}
              </View>
            );
          })}
        </View>
      )}
    </ChartCard>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    empty: { fontSize: 14, color: colors.textSubtle },
    rows: { gap: 14 },
    row: { gap: 6 },
    header: { flexDirection: "row", alignItems: "center", gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    name: { flex: 1, fontSize: 13, color: colors.textMuted },
    amounts: { fontSize: 13, color: colors.text, fontVariant: ["tabular-nums"] },
    over: { fontSize: 12, color: colors.danger, fontWeight: "600" },
  });
