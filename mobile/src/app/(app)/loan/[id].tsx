import Ionicons from "@expo/vector-icons/Ionicons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "../../../components/ui/Button";
import { Card, CenteredMessage, SectionTitle } from "../../../components/ui/layout";
import { Meter } from "../../../components/ui/Meter";
import { Notice } from "../../../components/ui/Notice";
import { type Colors } from "../../../components/ui/theme";
import { useDeleteLoan, useLoans, useRemoveRepayment } from "../../../features/loans/hooks";
import { describeLoanState, loanColor } from "../../../features/loans/loanDisplay";
import { confirmDestructive } from "../../../lib/confirm";
import { formatDisplayDate } from "../../../lib/dates";
import { extractErrorMessage } from "../../../lib/errors";
import { useColors, useSchemeColor, useThemedStyles } from "../../../context/ThemeContext";
import { useMoney } from "../../../lib/useMoney";

export default function LoanDetailScreen() {
  const money = useMoney();
  const schemeColor = useSchemeColor();
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  // Read live from the list query, so repayments added in the modal show up
  // here as soon as it closes.
  const { data: loans, isPending } = useLoans();
  const loan = loans?.find((l) => l.id === id);
  const deleteLoan = useDeleteLoan();
  const removeRepayment = useRemoveRepayment();
  const [error, setError] = useState<string | null>(null);

  if (!loan) {
    return <CenteredMessage loading={isPending}>{isPending ? undefined : "Loan not found."}</CenteredMessage>;
  }

  async function handleDelete(): Promise<void> {
    if (!loan) return;
    const ok = await confirmDestructive(
      "Delete loan?",
      "This also deletes the loan's transaction and every repayment transaction."
    );
    if (!ok) return;
    setError(null);
    try {
      await deleteLoan.mutateAsync(loan.id);
      router.back();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleRemoveRepayment(repaymentId: string, amountCents: number): Promise<void> {
    if (!loan) return;
    const ok = await confirmDestructive("Remove repayment?", `Removes the ${money.format(amountCents)} repayment and its transaction.`, "Remove");
    if (!ok) return;
    setError(null);
    try {
      await removeRepayment.mutateAsync({ id: loan.id, repaymentId });
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: loan.counterparty,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit loan"
              hitSlop={12}
              onPress={() => router.push({ pathname: "/loan/edit", params: { id: loan.id } })}
            >
              <Ionicons name="create-outline" size={22} color={colors.link} />
            </Pressable>
          ),
        }}
      />

      <Card style={styles.summary}>
        <Text style={styles.direction}>{loan.direction === "lent" ? "You lent" : "You borrowed"}</Text>
        <Text style={styles.principal}>{money.format(loan.principalCents)}</Text>
        <Meter value={loan.repaidCents} max={loan.principalCents} color={schemeColor(loanColor(loan))} />
        <View style={styles.summaryRow}>
          <Text style={styles.meta}>{describeLoanState(loan, money)}</Text>
          <Text style={styles.meta}>Repaid {money.format(loan.repaidCents)}</Text>
        </View>
        <Text style={styles.meta}>
          {formatDisplayDate(loan.date)}
          {loan.description ? ` · ${loan.description}` : ""}
        </Text>
      </Card>

      {loan.status !== "written_off" ? (
        <Button title="Add repayment" onPress={() => router.push({ pathname: "/loan/repayment", params: { id: loan.id } })} />
      ) : null}

      <SectionTitle>Repayments</SectionTitle>
      {loan.repayments.length === 0 ? (
        <Text style={styles.meta}>No repayments yet.</Text>
      ) : (
        <Card style={styles.repayments}>
          {loan.repayments.map((r, i) => (
            <View key={r.id} style={[styles.repayment, i > 0 && styles.repaymentBorder]}>
              <View style={styles.repaymentMain}>
                <Text style={styles.repaymentAmount}>{money.format(r.amountCents)}</Text>
                <Text style={styles.meta}>
                  {formatDisplayDate(r.date)}
                  {r.note ? ` · ${r.note}` : ""}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove repayment of ${money.format(r.amountCents)}`}
                hitSlop={12}
                onPress={() => void handleRemoveRepayment(r.id, r.amountCents)}
              >
                <Ionicons name="trash-outline" size={20} color={colors.textSubtle} />
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button title="Delete loan" variant="ghost" onPress={() => void handleDelete()} disabled={deleteLoan.isPending} />
    </ScrollView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    container: { padding: 16, gap: 16, paddingBottom: 40 },
    summary: { gap: 8 },
    direction: { fontSize: 14, color: colors.textSubtle },
    principal: { fontSize: 32, fontWeight: "600", color: colors.text },
    summaryRow: { flexDirection: "row", justifyContent: "space-between" },
    meta: { fontSize: 13, color: colors.textMuted },
    repayments: { paddingVertical: 4 },
    repayment: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 12 },
    repaymentBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    repaymentMain: { flex: 1, gap: 2 },
    repaymentAmount: { fontSize: 15, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },
  });
