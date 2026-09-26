import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../ui/theme";

interface ChartCardProps {
  title: string;
  children: ReactNode;
  tableView?: ReactNode;
}

// Same contract as the web ChartCard: every chart ships a plain table twin,
// so no value is only reachable through color or mark length.
export function ChartCard({ title, children, tableView }: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {tableView ? (
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setShowTable((prev) => !prev)}>
            <Text style={styles.toggle}>{showTable ? "View chart" : "View as table"}</Text>
          </Pressable>
        ) : null}
      </View>
      {showTable && tableView ? tableView : children}
    </View>
  );
}

// Minimal table for the chart twins: first column left-aligned, numbers right.
export function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <View>
      <View style={[styles.tableRow, styles.tableHeader]}>
        {headers.map((h, i) => (
          <Text key={h} style={[styles.cell, i > 0 && styles.numeric, styles.headerCell]}>
            {h}
          </Text>
        ))}
      </View>
      {rows.map((row, r) => (
        <View key={r} style={styles.tableRow}>
          {row.map((cell, i) => (
            <Text key={i} style={[styles.cell, i > 0 && styles.numeric]}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 15, fontWeight: "600", color: colors.text },
  toggle: { fontSize: 13, color: colors.primary },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tableHeader: { borderBottomWidth: 1 },
  cell: { flex: 1, fontSize: 13, color: colors.text },
  headerCell: { color: colors.textSubtle, fontWeight: "500" },
  numeric: { textAlign: "right", fontVariant: ["tabular-nums"] },
});
