import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { colors } from "../../../components/ui/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: IconName, focusedName: IconName) {
  return ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons name={focused ? focusedName : name} size={size} color={color} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Dashboard", tabBarIcon: tabIcon("pie-chart-outline", "pie-chart") }} />
      <Tabs.Screen
        name="transactions"
        options={{ title: "Transactions", tabBarIcon: tabIcon("list-outline", "list") }}
      />
      <Tabs.Screen name="loans" options={{ title: "Loans", tabBarIcon: tabIcon("people-outline", "people") }} />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: tabIcon("ellipsis-horizontal-circle-outline", "ellipsis-horizontal-circle") }} />
    </Tabs>
  );
}
