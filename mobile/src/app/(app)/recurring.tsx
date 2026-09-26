import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { RecurringTransaction } from "shared";
import { CenteredMessage, Fab } from "../../components/ui/layout";
import { radius, type Colors } from "../../components/ui/theme";
import { describeFrequency } from "../../features/recurring/describe";
import { useRecurring, useRunRecurringNow } from "../../features/recurring/hooks";
import { formatDisplayDate } from "../../lib/dates";
import { extractErrorMessage } from "../../lib/errors";
import { useSchemeColor, useThemedStyles } from "../../context/ThemeContext";

export default function RecurringScreen() {
  const styles = useThemedStyles(makeStyles);
  const query = useRecurring();
  const runNow = useRunRecurringNow();
  const [runMessages, setRunMessages] = useState<Record<string, string>>({});

  async function handleRunNow(id: string): Promise<void> {
    setRunMessages((prev) => ({ ...prev, [id]: "Running..." }));
    try {
      const { generated } = await runNow.mutateAsync(id);
      setRunMessages((prev) => ({ ...prev, [id]: generated > 0 ? `Generated ${generated}` : "Already up to date" }));
    } catch (err) {
      setRunMessages((prev) => ({ ...prev, [id]: extractErrorMessage(err) }));
    }
  }

  return (
    <View style={styles.flex}>
      <FlatList
        data={query.data ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <RecurringCard
            rule={item}
            runMessage={runMessages[item.id]}
            onPress={() => router.push({ pathname: "/recurring-rule/[id]", params: { id: item.id } })}
            onRunNow={() => void handleRunNow(item.id)}
          />
        )}
        ListEmptyComponent={
          query.isPending ? (
            <CenteredMessage loading />
          ) : query.isError ? (
            <CenteredMessage>{extractErrorMessage(query.error)}</CenteredMessage>
          ) : (
            <CenteredMessage>No recurring rules yet. Tap + to add rent, salary, subscriptions...</CenteredMessage>
          )
        }
        ListFooterComponent={<View style={styles.fabSpace} />}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
      />
      <Fab label="Add recurring transaction" onPress={() => router.push("/recurring-rule/new")} />
    </View>
  );
}

interface RecurringCardProps {
  rule: RecurringTransaction;
  runMessage?: string;
  onPress: () => void;
  onRunNow: () => void;
}

function RecurringCard({ rule, runMessage, onPress, onRunNow }: RecurringCardProps) {
  const schemeColor = useSchemeColor();
  const styles = useThemedStyles(makeStyles);
  const isIncome = rule.type === "income";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, !rule.isActive && styles.cardPaused]}
    >
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: schemeColor(rule.category.color) }]} />
        <Text style={styles.name} numberOfLines={1}>
          {rule.description || rule.category.name}
          {!rule.isActive ? <Text style={styles.paused}> (paused)</Text> : null}
        </Text>
        <Text style={[styles.amount, isIncome && styles.amountIncome]}>
          {isIncome ? "+" : "-"}
          {rule.amount.toFixed(2)}
        </Text>
      </View>
      <Text style={styles.meta}>
        {describeFrequency(rule.frequency, rule.interval)} · started {formatDisplayDate(rule.startDate)}
        {rule.endDate ? ` · ends ${formatDisplayDate(rule.endDate)}` : ""}
      </Text>
      <View style={styles.footer}>
        <Text style={styles.meta}>{runMessage ?? ""}</Text>
        {rule.isActive ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={onRunNow}>
            <Text style={styles.runNow}>Run now</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    list: { padding: 16, gap: 12 },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: 16,
      gap: 6,
    },
    cardPressed: { backgroundColor: colors.background },
    cardPaused: { opacity: 0.6 },
    header: { flexDirection: "row", alignItems: "center", gap: 8 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    name: { flex: 1, fontSize: 16, fontWeight: "500", color: colors.text },
    paused: { fontSize: 13, fontWeight: "400", color: colors.textSubtle },
    amount: { fontSize: 15, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },
    amountIncome: { color: colors.positive },
    meta: { fontSize: 13, color: colors.textMuted },
    footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 24 },
    runNow: { fontSize: 14, color: colors.link, fontWeight: "500" },
    fabSpace: { height: 72 },
  });
