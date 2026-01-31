import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Pressable, Alert, ActivityIndicator } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { testGeminiConnection } from "@/services/visionIngredients";
import { Text, View } from "@/components/Themed";

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isPremium, restorePurchases } = useSubscription();
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme ?? "light"].tint;
  const [testingGemini, setTestingGemini] = useState(false);

  const handleRestore = async () => {
    await restorePurchases();
  };

  const handleTestGemini = async () => {
    setTestingGemini(true);
    const { ok, error } = await testGeminiConnection();
    setTestingGemini(false);
    if (ok) {
      Alert.alert("Gemini", "Connection OK. Your API key is working.");
    } else {
      Alert.alert("Gemini", `Connection failed.\n\n${error ?? "Unknown error"}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.label}>Account</Text>
        <Text style={styles.value}>
          {user?.email ?? "Signed in anonymously"}
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Subscription</Text>
        <Text style={styles.value}>
          {isPremium ? "Pro / Recipe Pack active" : "Free"}
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.pressed,
          { borderColor: tint },
        ]}
        onPress={handleRestore}
      >
        <Text style={[styles.buttonText, { color: tint }]}>
          Restore purchases
        </Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.pressed,
          { borderColor: tint },
        ]}
        onPress={() => router.push("/settings")}
      >
        <Text style={[styles.buttonText, { color: tint }]}>Settings</Text>
      </Pressable>
      <View style={styles.section}>
        <Text style={styles.label}>API status</Text>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.pressed,
            { borderColor: tint },
          ]}
          onPress={handleTestGemini}
          disabled={testingGemini}
        >
          {testingGemini ? (
            <ActivityIndicator size="small" color={tint} />
          ) : (
            <Text style={[styles.buttonText, { color: tint }]}>
              Test Gemini connection
            </Text>
          )}
        </Pressable>
        <Text style={styles.hint}>
          Verifies EXPO_PUBLIC_GEMINI_API_KEY. Used for image → ingredients.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    opacity: 0.7,
    marginBottom: 4,
  },
  value: {
    fontSize: 17,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "600",
  },
  pressed: { opacity: 0.8 },
  hint: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 8,
    marginHorizontal: 4,
  },
});
