import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";
import "react-native-url-polyfill/auto";

import { useColorScheme } from "@/components/useColorScheme";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SubscriptionProvider } from "@/context/SubscriptionContext";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="recipe/[id]"
          options={{ headerShown: true, title: "Recipe" }}
        />
        <Stack.Screen
          name="paste"
          options={{ presentation: "modal", title: "Paste recipe link" }}
        />
        <Stack.Screen
          name="videos-to-list"
          options={{ headerShown: true, title: "Videos to grocery list" }}
        />
        <Stack.Screen
          name="identify-ingredients"
          options={{ headerShown: true, title: "Identify ingredients from photo or video" }}
        />
        <Stack.Screen
          name="paywall"
          options={{ presentation: "modal", title: "Unlock" }}
        />
        <Stack.Screen
          name="sign-in"
          options={{ presentation: "modal", title: "Sign in" }}
        />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
      </Stack>
    </ThemeProvider>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30 * 1000 },
  },
});

function Providers({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <QueryClientProvider client={queryClient}>
      <SubscriptionProvider userId={user?.id}>{children}</SubscriptionProvider>
    </QueryClientProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync().catch(() => {
        // Ignore when native splash isn't registered (e.g. web, some dev flows)
      });
    }
  }, [loaded]);

  if (!loaded) return null;

  return (
    <AuthProvider>
      <Providers>
        <RootLayoutNav />
      </Providers>
    </AuthProvider>
  );
}
