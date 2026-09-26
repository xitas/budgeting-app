import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Transaction, TransactionType } from "shared";
import { CenteredMessage, Fab } from "../../../components/ui/layout";
import { SegmentedControl } from "../../../components/ui/SegmentedControl";
import { type Colors } from "../../../components/ui/theme";
import { useCategories } from "../../../features/categories/hooks";
import { useInfiniteTransactions } from "../../../features/transactions/hooks";
import { formatDisplayDate } from "../../../lib/dates";
import { extractErrorMessage } from "../../../lib/errors";
import { useColors, useSchemeColor, useThemedStyles } from "../../../context/ThemeContext";

type TypeFilter = "all" | TransactionType;

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

export default function TransactionsScreen() {
  const schemeColor = useSchemeColor();
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const { data: categories } = useCategories();

  const query = useInfiniteTransactions({
    type: typeFilter === "all" ? undefined : typeFilter,
    category: categoryFilter || undefined,
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const filterCategories = (categories ?? []).filter((c) => typeFilter === "all" || c.type === typeFilter);

  function openTransaction(tx: Transaction): void {
    if (tx.source === "loan") {
      // Server blocks this (409) — the loan and its transaction must stay in sync.
      Alert.alert("Managed in Loans", "This transaction belongs to a loan. Edit it from the Loans tab.");
      return;
    }
    router.push({ pathname: "/transaction/[id]", params: { id: tx.id } });
  }

  return (
    <View style={styles.flex}>
      <FlatList
        data={items}
        keyExtractor={(tx) => tx.id}
        renderItem={({ item }) => <TransactionRow tx={item} onPress={() => openTransaction(item)} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.filters}>
            <SegmentedControl
              options={TYPE_FILTERS}
              value={typeFilter}
              onChange={(next) => {
                setTypeFilter(next);
                setCategoryFilter("");
              }}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <FilterChip label="All categories" selected={!categoryFilter} onPress={() => setCategoryFilter("")} />
              {filterCategories.map((c) => (
                <FilterChip
                  key={c.id}
                  label={c.name}
                  color={schemeColor(c.color)}
                  selected={categoryFilter === c.id}
                  onPress={() => setCategoryFilter(c.id)}
                />
              ))}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          query.isPending ? (
            <CenteredMessage loading />
          ) : query.isError ? (
            <CenteredMessage>{extractErrorMessage(query.error)}</CenteredMessage>
          ) : (
            <CenteredMessage>No transactions found.</CenteredMessage>
          )
        }
        ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.link} /> : <View style={styles.fabSpace} />}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => void query.refetch()} />}
      />
      <Fab label="Add transaction" onPress={() => router.push("/transaction/new")} />
    </View>
  );
}

function TransactionRow({ tx, onPress }: { tx: Transaction; onPress: () => void }) {
  const schemeColor = useSchemeColor();
  const styles = useThemedStyles(makeStyles);
  const isIncome = tx.type === "income";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={tx.source === "loan" ? "Managed in the Loans tab" : "Opens the edit form"}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.dot, { backgroundColor: schemeColor(tx.category.color) }]} />
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {tx.description || tx.category.name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {tx.category.name} · {formatDisplayDate(tx.date)}
          {tx.source === "recurring" ? " · recurring" : tx.source === "loan" ? " · loan" : ""}
        </Text>
      </View>
      <Text style={[styles.amount, isIncome && styles.amountIncome]}>
        {isIncome ? "+" : "-"}
        {tx.amount.toFixed(2)}
      </Text>
    </Pressable>
  );
}

function FilterChip({ label, color, selected, onPress }: { label: string; color?: string; selected: boolean; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      {color ? <View style={[styles.chipDot, { backgroundColor: color }]} /> : null}
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    filters: { padding: 16, gap: 12 },
    chips: { gap: 8 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.surface,
    },
    chipSelected: { borderColor: colors.link, backgroundColor: colors.selectedBg },
    chipDot: { width: 8, height: 8, borderRadius: 4 },
    chipLabel: { fontSize: 13, color: colors.text },
    chipLabelSelected: { color: colors.selectedText, fontWeight: "600" },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface },
    rowPressed: { backgroundColor: colors.border },
    dot: { width: 10, height: 10, borderRadius: 5 },
    rowMain: { flex: 1, gap: 2 },
    rowTitle: { fontSize: 15, color: colors.text },
    rowMeta: { fontSize: 13, color: colors.textSubtle },
    amount: { fontSize: 15, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },
    amountIncome: { color: colors.positive },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    footer: { padding: 16 },
    fabSpace: { height: 88 },
  });
