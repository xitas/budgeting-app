import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { Budget } from "shared";
import { CenteredMessage, Fab, FAB_CLEARANCE } from "../../components/ui/layout";
import { Meter } from "../../components/ui/Meter";
import { MonthSwitcher } from "../../components/ui/MonthSwitcher";
import { radius, type Colors } from "../../components/ui/theme";
import { useBudgets } from "../../features/budgets/hooks";
import { extractErrorMessage } from "../../lib/errors";
import { useColors, useSchemeColor, useThemedStyles } from "../../context/ThemeContext";

export default function BudgetsScreen() {
  const styles = useThemedStyles(makeStyles);
  const now = new Date();
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const query = useBudgets(period.month, period.year);

  return (
    <View style={styles.flex}>
      <FlatList
        data={query.data ?? []}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<MonthSwitcher month={period.month} year={period.year} onChange={setPeriod} />}
        renderItem={({ item }) => (
          <BudgetCard
            budget={item}
            onPress={() =>
              router.push({
                pathname: "/budget/[id]",
                params: { id: item.id, month: String(period.month), year: String(period.year) },
              })
            }
          />
        )}
        ListEmptyComponent={
          query.isPending ? (
            <CenteredMessage loading />
          ) : query.isError ? (
            <CenteredMessage>{extractErrorMessage(query.error)}</CenteredMessage>
          ) : (
            <CenteredMessage>No budgets for this month. Tap + to set a limit for a category.</CenteredMessage>
          )
        }
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
      />
      <Fab
        label="Add budget"
        onPress={() => router.push({ pathname: "/budget/new", params: { month: String(period.month), year: String(period.year) } })}
      />
    </View>
  );
}

function BudgetCard({ budget, onPress }: { budget: Budget; onPress: () => void }) {
  const schemeColor = useSchemeColor();
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const over = budget.remaining < 0;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: schemeColor(budget.category.color) }]} />
        <Text style={styles.name} numberOfLines={1}>
          {budget.category.name}
        </Text>
        <Text style={styles.amounts}>
          {budget.spent.toFixed(2)} / {budget.limit.toFixed(2)}
        </Text>
      </View>
      <Meter value={budget.spent} max={budget.limit} color={schemeColor(budget.category.color)} overColor={colors.danger} />
      <Text style={[styles.status, over && styles.statusOver]}>
        {over ? `Over by ${Math.abs(budget.remaining).toFixed(2)}` : `${budget.remaining.toFixed(2)} left`}
      </Text>
    </Pressable>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    list: { padding: 16, gap: 12, paddingBottom: FAB_CLEARANCE },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: 16,
      gap: 10,
    },
    cardPressed: { backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", gap: 8 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    name: { flex: 1, fontSize: 16, fontWeight: "500", color: colors.text },
    amounts: { fontSize: 14, color: colors.text, fontVariant: ["tabular-nums"] },
    status: { fontSize: 13, color: colors.textMuted },
    statusOver: { color: colors.danger, fontWeight: "600" },
  });
