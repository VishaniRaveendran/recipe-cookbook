import { useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Text, View } from "@/components/Themed";

const ONBOARDING_SEEN = "onboarding_seen";

export default function OnboardingScreen() {
  const router = useRouter();

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_SEEN).then((seen) => {
      if (seen === "true") {
        router.replace("/(tabs)");
      }
    });
  }, [router]);

  const handleContinue = async () => {
    await AsyncStorage.setItem(ONBOARDING_SEEN, "true");
    router.replace("/(tabs)");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Stop saving recipes.{"\n"}Start cooking them.
      </Text>
      <Text style={styles.subtitle}>
        You're one list away from dinner. Paste any recipe link and get a clean
        recipe plus a grocery list.
      </Text>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        onPress={handleContinue}
      >
        <Text style={styles.buttonText}>Get started</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 17,
    opacity: 0.8,
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 24,
  },
  button: {
    backgroundColor: "#2f95dc",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
