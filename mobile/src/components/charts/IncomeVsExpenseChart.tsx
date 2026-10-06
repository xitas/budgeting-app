import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CATEGORICAL_PALETTE, centsToUnits, type MonthlyTrendPoint } from "shared";
import { MONTH_NAMES, shortMonthLabel } from "../../lib/dates";
import { type Colors } from "../ui/theme";
import { ChartCard, DataTable } from "./ChartCard";
import { formatAmount, formatCompact, niceCeiling } from "./chartUtils";
import { useSchemeColor, useThemedStyles } from "../../context/ThemeContext";

// Same slots as the web chart: palette order, never reassigned.
const INCOME_COLOR = CATEGORICAL_PALETTE[0];
const EXPENSE_COLOR = CATEGORICAL_PALETTE[1];

const PLOT_HEIGHT = 140;
const COLUMN_WIDTH = 12;
const AXIS_WIDTH = 36;

// Grouped columns, one group per month. Touch has no hover, so tapping a
// month selects it and the readout above the plot plays the tooltip's role;
// the latest month starts selected (label the endpoint).
export function IncomeVsExpenseChart({ data }: { data: MonthlyTrendPoint[] }) {
  const styles = useThemedStyles(makeStyles);
  const schemeColor = useSchemeColor();
  const incomeColor = schemeColor(INCOME_COLOR);
  const expenseColor = schemeColor(EXPENSE_COLOR);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  // Axis in currency units (ticks read 1K / 2K, not 100K cents).
  const top = niceCeiling(centsToUnits(Math.max(...data.map((p) => Math.max(p.incomeCents, p.expenseCents)), 0)));
  const ticks = [top, top / 2, 0];
  const selected = data[selectedIndex ?? data.length - 1];

  return (
    <ChartCard
      title="Income vs expense"
      tableView={
        <DataTable
          headers={["Month", "Income", "Expense"]}
          rows={data.map((p) => [monthName(p.month), formatAmount(p.incomeCents), formatAmount(p.expenseCents)])}
        />
      }
    >
      <View style={styles.legend}>
        <LegendItem color={incomeColor} label="Income" />
        <LegendItem color={expenseColor} label="Expense" />
      </View>

      {selected ? (
        <Text style={styles.readout}>
          <Text style={styles.readoutMonth}>{monthName(selected.month)}</Text>
          {"  "}Income {formatAmount(selected.incomeCents)} · Expense {formatAmount(selected.expenseCents)}
        </Text>
      ) : null}

      <View style={styles.chart}>
        <View style={styles.yAxis}>
          {ticks.map((t) => (
            <Text key={t} style={styles.tick}>
              {formatCompact(t)}
            </Text>
          ))}
        </View>
        <View style={styles.plotArea}>
          <View style={styles.plot}>
            {/* Hairline gridlines at the tick values; the 0 line is the baseline. */}
            {ticks.map((t) => (
              <View key={t} style={[styles.gridline, { bottom: (t / top) * PLOT_HEIGHT }]} />
            ))}
            {data.map((p, i) => {
              const isSelected = i === (selectedIndex ?? data.length - 1);
              return (
                <Pressable
                  key={p.month}
                  accessibilityRole="button"
                  accessibilityLabel={`${monthName(p.month)}: income ${formatAmount(p.incomeCents)}, expense ${formatAmount(p.expenseCents)}`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setSelectedIndex(i)}
                  // The whole month band is the hit target, not just the thin columns.
                  style={[styles.group, isSelected && styles.groupSelected]}
                >
                  <View style={[styles.column, { height: (centsToUnits(p.incomeCents) / top) * PLOT_HEIGHT, backgroundColor: incomeColor }]} />
                  <View style={[styles.column, { height: (centsToUnits(p.expenseCents) / top) * PLOT_HEIGHT, backgroundColor: expenseColor }]} />
                </Pressable>
              );
            })}
          </View>
          <View style={styles.xAxis}>
            {data.map((p) => (
              <Text key={p.month} style={styles.xLabel}>
                {shortMonthLabel(p.month)}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </ChartCard>
  );
}

function monthName(yearMonth: string): string {
  // "2026-01" -> "January 2026"
  return `${MONTH_NAMES[Number(yearMonth.slice(5, 7)) - 1]} ${yearMonth.slice(0, 4)}`;
}

function LegendItem({ color, label }: { color: string; label: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    legend: { flexDirection: "row", gap: 16 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    swatch: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { fontSize: 12, color: colors.textMuted },
    readout: { fontSize: 13, color: colors.text, fontVariant: ["tabular-nums"] },
    readoutMonth: { fontWeight: "600" },
    chart: { flexDirection: "row" },
    yAxis: { width: AXIS_WIDTH, height: PLOT_HEIGHT, justifyContent: "space-between", marginTop: -7, marginBottom: 7 },
    tick: { fontSize: 11, color: colors.textSubtle, fontVariant: ["tabular-nums"] },
    plotArea: { flex: 1 },
    plot: { height: PLOT_HEIGHT, flexDirection: "row", alignItems: "flex-end" },
    gridline: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    group: {
      flex: 1,
      height: "100%",
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "center",
      gap: 2, // the 2px surface gap between touching columns
      borderRadius: 4,
    },
    groupSelected: { backgroundColor: colors.chartCursor },
    column: {
      width: COLUMN_WIDTH,
      minHeight: 1,
      // Rounded at the data end (top), square on the baseline.
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
    },
    xAxis: { flexDirection: "row", marginTop: 6 },
    xLabel: { flex: 1, textAlign: "center", fontSize: 11, color: colors.textSubtle },
  });
