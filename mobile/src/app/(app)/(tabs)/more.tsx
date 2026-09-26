import Ionicons from "@expo/vector-icons/Ionicons";
import { router, type Href } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "../../../components/ui/Button";
import { Card, SectionTitle } from "../../../components/ui/layout";
import { colors } from "../../../components/ui/theme";
import { useAuth } from "../../../context/AuthContext";

type IconName = ComponentProps<typeof Ionicons>["name"];

const LINKS: { href: Href; label: string; description: string; icon: IconName }[] = [
  { href: "/budgets", label: "Budgets", description: "Monthly limits per expense category", icon: "wallet-outline" },
  { href: "/categories", label: "Categories", description: "Names and colors for your income and expenses", icon: "pricetags-outline" },
  { href: "/recurring", label: "Recurring", description: "Rules that add transactions automatically", icon: "repeat-outline" },
];

export default function MoreScreen() {
  const { user, logout } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.links}>
        {LINKS.map((link, i) => (
          <Pressable
            key={link.label}
            accessibilityRole="button"
            onPress={() => router.push(link.href)}
            style={({ pressed }) => [styles.link, i > 0 && styles.linkBorder, pressed && styles.linkPressed]}
          >
            <Ionicons name={link.icon} size={22} color={colors.primary} />
            <View style={styles.linkText}>
              <Text style={styles.linkLabel}>{link.label}</Text>
              <Text style={styles.linkDescription}>{link.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
          </Pressable>
        ))}
      </Card>

      <SectionTitle>Account</SectionTitle>
      <Card style={styles.account}>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </Card>
      <Button title="Log out" variant="ghost" onPress={() => void logout()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  links: { padding: 0 },
  link: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  linkBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  linkPressed: { backgroundColor: colors.background },
  linkText: { flex: 1, gap: 2 },
  linkLabel: { fontSize: 16, color: colors.text, fontWeight: "500" },
  linkDescription: { fontSize: 13, color: colors.textSubtle },
  account: { gap: 2 },
  name: { fontSize: 16, fontWeight: "600", color: colors.text },
  email: { fontSize: 14, color: colors.textMuted },
});
