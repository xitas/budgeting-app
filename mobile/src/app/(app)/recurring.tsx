import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { RecurringTransaction } from "shared";
import { CenteredMessage, Fab, FAB_CLEARANCE } from "../../components/ui/layout";
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
  const title = rule.description || rule.category.name;
  // "Run now" is a sibling laid over the card's bottom-right corner, not a
  // child: nested pressables merge into one control for screen readers (and
  // nest <button>s on web).
  return (
    <View style={!rule.isActive && styles.cardPaused}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Opens the edit form"
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.header}>
          <View style={[styles.dot, { backgroundColor: schemeColor(rule.category.color) }]} />
          <Text style={styles.name} numberOfLines={1}>
            {title}
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
        <View style={[styles.footer, rule.isActive && styles.footerWithRunNow]}>
          <Text style={styles.meta}>{runMessage ?? ""}</Text>
        </View>
      </Pressable>
      {rule.isActive ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Run now: ${title}`}
          hitSlop={8}
          onPress={onRunNow}
          style={styles.runNowButton}
        >
          <Text style={styles.runNow}>Run now</Text>
        </Pressable>
      ) : null}
    </View>
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
    footerWithRunNow: { paddingRight: 80 }, // keeps the run message clear of the overlaid button
    // card padding (16) + border (1), so it sits exactly where the footer row ends
    runNowButton: { position: "absolute", right: 17, bottom: 17, height: 24, justifyContent: "center" },
    runNow: { fontSize: 14, color: colors.link, fontWeight: "500" },
  });
