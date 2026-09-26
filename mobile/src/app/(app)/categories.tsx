import { router } from "expo-router";
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import type { Category } from "shared";
import { CenteredMessage, Fab, SectionTitle } from "../../components/ui/layout";
import { type Colors } from "../../components/ui/theme";
import { useCategories } from "../../features/categories/hooks";
import { extractErrorMessage } from "../../lib/errors";
import { useSchemeColor, useThemedStyles } from "../../context/ThemeContext";

export default function CategoriesScreen() {
  const styles = useThemedStyles(makeStyles);
  const query = useCategories();
  const categories = query.data ?? [];
  const sections = [
    { title: "Expense", data: categories.filter((c) => c.type === "expense") },
    { title: "Income", data: categories.filter((c) => c.type === "income") },
  ].filter((s) => s.data.length > 0);

  return (
    <View style={styles.flex}>
      <SectionList
        sections={sections}
        keyExtractor={(c) => c.id}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <SectionTitle>{section.title}</SectionTitle>
          </View>
        )}
        renderItem={({ item }) => (
          <CategoryRow category={item} onPress={() => router.push({ pathname: "/category/[id]", params: { id: item.id } })} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          query.isPending ? (
            <CenteredMessage loading />
          ) : query.isError ? (
            <CenteredMessage>{extractErrorMessage(query.error)}</CenteredMessage>
          ) : (
            <CenteredMessage>No categories yet.</CenteredMessage>
          )
        }
        ListFooterComponent={<View style={styles.fabSpace} />}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
      />
      <Fab label="Add category" onPress={() => router.push("/category/new")} />
    </View>
  );
}

function CategoryRow({ category, onPress }: { category: Category; onPress: () => void }) {
  const schemeColor = useSchemeColor();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={[styles.dot, { backgroundColor: schemeColor(category.color) }]} />
      <Text style={styles.name}>{category.name}</Text>
      {category.isDefault ? <Text style={styles.tag}>default</Text> : null}
    </Pressable>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    sectionHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.surface },
    rowPressed: { backgroundColor: colors.border },
    dot: { width: 12, height: 12, borderRadius: 6 },
    name: { flex: 1, fontSize: 15, color: colors.text },
    tag: { fontSize: 12, color: colors.textSubtle },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    fabSpace: { height: 88 },
  });
