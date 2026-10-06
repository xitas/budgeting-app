import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatMoney } from "shared";
import { BudgetVsActualChart } from "../../../components/charts/BudgetVsActualChart";
import { IncomeVsExpenseChart } from "../../../components/charts/IncomeVsExpenseChart";
import { SpendingByCategoryChart } from "../../../components/charts/SpendingByCategoryChart";
import { StatTile } from "../../../components/charts/StatTile";
import { MonthSwitcher } from "../../../components/ui/MonthSwitcher";
import { Notice } from "../../../components/ui/Notice";
import { type Colors } from "../../../components/ui/theme";
import { useAuth } from "../../../context/AuthContext";
import {
  useBudgetVsActual,
  useDashboardSummary,
  useIncomeVsExpense,
  useSpendingByCategory,
} from "../../../features/dashboard/hooks";
import { useThemedStyles } from "../../../context/ThemeContext";

export default function DashboardScreen() {
  const styles = useThemedStyles(makeStyles);
  const { user } = useAuth();
  const now = new Date();
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const { month, year } = period;

  const summary = useDashboardSummary(month, year);
  const spending = useSpendingByCategory(month, year);
  const trend = useIncomeVsExpense(month, year, 6);
  const budgets = useBudgetVsActual(month, year);
  const queries = [summary, spending, trend, budgets];
  const hasError = queries.some((q) => q.isError);
  const isRefreshing = queries.some((q) => q.isRefetching);

  const s = summary.data;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => queries.forEach((q) => void q.refetch())} />
      }
    >
      <Text style={styles.greeting}>Hi, {user?.name}</Text>
      <MonthSwitcher month={month} year={year} onChange={setPeriod} />

      {hasError ? <Notice tone="error">Some dashboard data couldn&apos;t load. Pull down to retry.</Notice> : null}

      {/* Same tones as the web dashboard. */}
      <View style={styles.tiles}>
        <StatTile label="Income" value={formatMoney(s?.incomeCents ?? 0)} tone="positive" />
        <StatTile label="Expense" value={formatMoney(s?.expenseCents ?? 0)} tone="negative" />
        <StatTile label="Net lending" value={formatMoney(s?.netLendingCents ?? 0)} tone={s && s.netLendingCents < 0 ? "negative" : "neutral"} />
        <StatTile label="Net" value={formatMoney(s?.netCents ?? 0)} tone={s && s.netCents < 0 ? "negative" : "neutral"} />
      </View>

      <SpendingByCategoryChart data={spending.data ?? []} />
      <BudgetVsActualChart data={budgets.data ?? []} />
      <IncomeVsExpenseChart data={trend.data ?? []} />
    </ScrollView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    container: { padding: 16, gap: 16, paddingBottom: 32 },
    greeting: { fontSize: 20, fontWeight: "600", color: colors.text },
    tiles: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  });
