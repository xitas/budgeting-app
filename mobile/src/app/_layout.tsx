import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { type Colors } from "../components/ui/theme";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { ThemeProvider, useColors, useTheme, useThemedStyles } from "../context/ThemeContext";

export default function RootLayout() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })
  );

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedNavigation>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </QueryClientProvider>
        </ThemedNavigation>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// Hands our palette to the navigator so headers, the tab bar, modal cards
// and screen backgrounds follow the theme without per-screen styling.
function ThemedNavigation({ children }: { children: React.ReactNode }) {
  const { scheme, colors } = useTheme();
  const navigationTheme = useMemo(() => {
    const base = scheme === "dark" ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.link,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.danger,
      },
    };
  }, [scheme, colors]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      {children}
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
    </NavigationThemeProvider>
  );
}

// Guards swap whole route groups as auth state changes: logging in unlocks
// (app) and locks (auth), logging out does the reverse — and Expo Router
// wipes the history of whichever group gets locked, so "back" can't return
// to a screen the user is no longer allowed to see.
function RootNavigator() {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.link} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={user !== null}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={user === null}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  });
