import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Pressable, Platform } from "react-native";
import { useSubscription } from "@/context/SubscriptionContext";
import { Text, View } from "@/components/Themed";

export default function PaywallScreen() {
  const router = useRouter();
  const { isPremium, restorePurchases } = useSubscription();
  const [restoring, setRestoring] = useState(false);

  if (isPremium) {
    router.back();
    return null;
  }

  const handleRestore = async () => {
    setRestoring(true);
    const ok = await restorePurchases();
    setRestoring(false);
    if (ok) router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Unlock unlimited recipes and Cook Tonight
      </Text>
      <Text style={styles.subtitle}>
        Save as many recipes as you want. Use Cook Tonight anytime. You're one
        list away from dinner.
      </Text>
      <View style={styles.pricing}>
        <Text style={styles.price}>$4.99/month</Text>
        <Text style={styles.priceYear}>or $29.99/year (save 50%)</Text>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.primary,
          pressed && styles.pressed,
        ]}
        onPress={() => {
          if (Platform.OS === "ios" || Platform.OS === "android") {
            import("react-native-purchases").then(({ default: Purchases }) => {
              Purchases.getOfferings()
                .then((offerings) => {
                  const defaultOffering = offerings.current;
                  if (defaultOffering?.availablePackages?.length) {
                    const pkg = defaultOffering.availablePackages[0];
                    Purchases.purchasePackage(pkg)
                      .then(() => router.back())
                      .catch(() => {});
                  }
                })
                .catch(() => {});
            });
          }
        }}
      >
        <Text style={styles.primaryText}>Subscribe</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.secondary,
          pressed && styles.pressed,
        ]}
        onPress={handleRestore}
        disabled={restoring}
      >
        <Text style={styles.secondaryText}>
          {restoring ? "Restoring…" : "Restore purchases"}
        </Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        onPress={() => router.back()}
      >
        <Text style={styles.closeText}>Maybe later</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  pricing: { marginBottom: 32, alignItems: "center" },
  price: { fontSize: 28, fontWeight: "700" },
  priceYear: { fontSize: 16, opacity: 0.8, marginTop: 4 },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  primary: { backgroundColor: "#2f95dc" },
  primaryText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  secondary: { borderWidth: 2, borderColor: "#2f95dc" },
  secondaryText: { color: "#2f95dc", fontSize: 17, fontWeight: "600" },
  pressed: { opacity: 0.8 },
  close: { marginTop: 24, alignItems: "center" },
  closeText: { fontSize: 16, opacity: 0.7 },
});
