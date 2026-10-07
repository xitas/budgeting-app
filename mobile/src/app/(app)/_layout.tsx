import { Stack } from "expo-router";
import { useColors } from "../../context/ThemeContext";

// Tabs are the base; every add/edit form opens as a modal on top, and the
// secondary lists (budgets, categories, recurring) push from the More tab.
export default function AppLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      <Stack.Screen name="budgets" options={{ title: "Budgets" }} />
      <Stack.Screen name="categories" options={{ title: "Categories" }} />
      <Stack.Screen name="recurring" options={{ title: "Recurring" }} />

      <Stack.Screen name="account/verify-email" options={{ presentation: "modal", title: "Verify your email" }} />

      <Stack.Screen name="transaction/new" options={{ presentation: "modal", title: "Add transaction" }} />
      <Stack.Screen name="transaction/[id]" options={{ presentation: "modal", title: "Edit transaction" }} />
      <Stack.Screen name="loan/new" options={{ presentation: "modal", title: "Add loan" }} />
      <Stack.Screen name="loan/[id]" options={{ title: "Loan" }} />
      <Stack.Screen name="loan/edit" options={{ presentation: "modal", title: "Edit loan" }} />
      <Stack.Screen name="loan/repayment" options={{ presentation: "modal", title: "Add repayment" }} />
      <Stack.Screen name="budget/new" options={{ presentation: "modal", title: "Add budget" }} />
      <Stack.Screen name="budget/[id]" options={{ presentation: "modal", title: "Edit budget" }} />
      <Stack.Screen name="category/new" options={{ presentation: "modal", title: "Add category" }} />
      <Stack.Screen name="category/[id]" options={{ presentation: "modal", title: "Edit category" }} />
      <Stack.Screen name="recurring-rule/new" options={{ presentation: "modal", title: "Add recurring" }} />
      <Stack.Screen name="recurring-rule/[id]" options={{ presentation: "modal", title: "Edit recurring" }} />
    </Stack>
  );
}
