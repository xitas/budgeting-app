import { router } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { Loan } from "shared";
import { CenteredMessage, Fab, FAB_CLEARANCE } from "../../../components/ui/layout";
import { Meter } from "../../../components/ui/Meter";
import { radius, type Colors } from "../../../components/ui/theme";
import { useLoans } from "../../../features/loans/hooks";
import { describeLoanState, loanColor } from "../../../features/loans/loanDisplay";
import { formatDisplayDate } from "../../../lib/dates";
import { extractErrorMessage } from "../../../lib/errors";
import { useSchemeColor, useThemedStyles } from "../../../context/ThemeContext";

export default function LoansScreen() {
  const styles = useThemedStyles(makeStyles);
  const query = useLoans();

  return (
    <View style={styles.flex}>
      <FlatList
        data={query.data ?? []}
        keyExtractor={(loan) => loan.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <LoanCard loan={item} onPress={() => router.push({ pathname: "/loan/[id]", params: { id: item.id } })} />
        )}
        ListEmptyComponent={
          query.isPending ? (
            <CenteredMessage loading />
          ) : query.isError ? (
            <CenteredMessage>{extractErrorMessage(query.error)}</CenteredMessage>
          ) : (
            <CenteredMessage>No loans tracked yet. Tap + to record money you lent or borrowed.</CenteredMessage>
          )
        }
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
      />
      <Fab label="Add loan" onPress={() => router.push("/loan/new")} />
    </View>
  );
}

function LoanCard({ loan, onPress }: { loan: Loan; onPress: () => void }) {
  const schemeColor = useSchemeColor();
  const styles = useThemedStyles(makeStyles);
  const closed = loan.status !== "open";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, closed && styles.cardClosed]}
    >
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>
          {loan.counterparty}
        </Text>
        <Text style={styles.direction}>{loan.direction === "lent" ? "You lent" : "You borrowed"}</Text>
      </View>
      <Meter value={loan.repaid} max={loan.principal} color={schemeColor(loanColor(loan))} />
      <View style={styles.footer}>
        <Text style={styles.meta}>
          {describeLoanState(loan)} · {formatDisplayDate(loan.date)}
        </Text>
        <Text style={styles.amounts}>
          {loan.repaid.toFixed(2)} / {loan.principal.toFixed(2)}
        </Text>
      </View>
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
    cardClosed: { opacity: 0.7 },
    header: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
    name: { flex: 1, fontSize: 16, fontWeight: "600", color: colors.text },
    direction: { fontSize: 13, color: colors.textSubtle },
    footer: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    meta: { flex: 1, fontSize: 13, color: colors.textMuted },
    amounts: { fontSize: 13, color: colors.text, fontVariant: ["tabular-nums"] },
  });
