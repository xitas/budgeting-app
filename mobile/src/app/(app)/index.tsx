import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/ui/Button";
import { Notice } from "../../components/ui/Notice";
import { colors, radius } from "../../components/ui/theme";
import { useAuth } from "../../context/AuthContext";
import { useSummary } from "../../features/dashboard/api";
import { extractErrorMessage } from "../../lib/errors";

type Tone = "positive" | "negative" | "neutral";

const TONE_COLOR: Record<Tone, string> = {
  positive: colors.positive,
  negative: colors.danger,
  neutral: colors.text,
};

function toneOf(value: number): Tone {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

// Placeholder home for M11: proves an authenticated round trip works from the
// phone. M12 replaces it with the real dashboard and feature screens.
export default function HomeScreen() {
  const { user, logout } = useAuth();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const summary = useSummary(month, year);
  const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={summary.isRefetching} onRefresh={() => void summary.refetch()} />}
    >
      <Text style={styles.greeting}>Hi, {user?.name}</Text>
      <Text style={styles.subtitle}>{monthLabel}</Text>

      {summary.isPending ? (
        <ActivityIndicator color={colors.primary} />
      ) : summary.isError ? (
        <Notice tone="error">{extractErrorMessage(summary.error)}</Notice>
      ) : (
        <View style={styles.tiles}>
          <StatTile label="Income" value={summary.data.income} tone="positive" />
          <StatTile label="Expense" value={summary.data.expense} tone="negative" />
          <StatTile label="Net lending" value={summary.data.netLending} tone={toneOf(summary.data.netLending)} />
          <StatTile label="Net" value={summary.data.net} tone={toneOf(summary.data.net)} />
        </View>
      )}

      <Text style={styles.comingSoon}>Transactions, budgets, loans and charts are coming in the next milestone.</Text>
      <Button title="Log out" variant="ghost" onPress={() => void logout()} />
    </ScrollView>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, { color: TONE_COLOR[tone] }]}>{value.toFixed(2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  greeting: { fontSize: 22, fontWeight: "600", color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSubtle, marginTop: -12 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
  },
  tileLabel: { fontSize: 14, color: colors.textSubtle },
  tileValue: { fontSize: 22, fontWeight: "600", marginTop: 4 },
  comingSoon: { fontSize: 14, color: colors.textMuted },
});
