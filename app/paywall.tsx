import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { StyleSheet, Pressable, Platform } from "react-native";
import { useSubscription } from "@/context/SubscriptionContext";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Text, View } from "@/components/Themed";

type PackageInfo = { identifier: string; title: string; price: string };

export default function PaywallScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { isPremium, restorePurchases, refreshCustomerInfo } = useSubscription();
  const [restoring, setRestoring] = useState(false);
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);

  useEffect(() => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") {
      setLoadingPackages(false);
      return;
    }
    import("react-native-purchases")
      .then(({ default: Purchases }) =>
        Purchases.getOfferings().then((offerings) => {
          const current = offerings.current;
          if (!current?.availablePackages?.length) {
            setPackages([]);
            return;
          }
          const list: PackageInfo[] = current.availablePackages.map((pkg) => ({
            identifier: pkg.identifier,
            title: pkg.packageType,
            price: pkg.product.priceString,
          }));
          setPackages(list);
        })
      )
      .catch(() => setPackages([]))
      .finally(() => setLoadingPackages(false));
  }, []);

  if (isPremium) {
    router.back();
    return null;
  }

  const tint = Colors[colorScheme ?? "light"].tint;
  const primary = Colors[colorScheme ?? "light"].primary ?? tint;

  const handleRestore = async () => {
    setRestoring(true);
    const ok = await restorePurchases();
    setRestoring(false);
    if (ok) {
      await refreshCustomerInfo();
      router.back();
    }
  };

  const handlePurchase = (packageIdentifier: string) => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    import("react-native-purchases").then(({ default: Purchases }) => {
      Purchases.getOfferings()
        .then((offerings) => {
          const pkg = offerings.current?.availablePackages?.find(
            (p) => p.identifier === packageIdentifier
          );
          if (pkg) {
            Purchases.purchasePackage(pkg)
              .then(() => refreshCustomerInfo().then(() => router.back()))
              .catch(() => {});
          }
        })
        .catch(() => {});
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unlock the Smart Importer</Text>
      <Text style={styles.subtitle}>
        You've used your 3 free recipe imports. Subscribe to Pro for unlimited
        imports, or get the Recipe Pack once and import more recipes anytime.
      </Text>
      {loadingPackages ? (
        <Text style={styles.price}>Loading…</Text>
      ) : packages.length > 0 ? (
        <View style={styles.pricing}>
          {packages.map((pkg) => (
            <Pressable
              key={pkg.identifier}
              style={({ pressed }) => [
                styles.button,
                styles.primary,
                pressed && styles.pressed,
                { backgroundColor: primary },
              ]}
              onPress={() => handlePurchase(pkg.identifier)}
            >
              <Text style={styles.primaryText}>
                {pkg.title} — {pkg.price}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.pricing}>
          <Text style={styles.price}>Pro: Monthly</Text>
          <Text style={styles.priceYear}>Recipe Pack: One-time</Text>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.primary,
              pressed && styles.pressed,
              { backgroundColor: primary },
            ]}
            onPress={() => handlePurchase("$rc_monthly")}
          >
            <Text style={styles.primaryText}>Subscribe (Pro)</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.secondary,
              pressed && styles.pressed,
              { borderColor: primary },
            ]}
            onPress={() => handlePurchase("$rc_lifetime")}
          >
            <Text style={[styles.secondaryText, { color: primary }]}>
              Recipe Pack (One-time)
            </Text>
          </Pressable>
        </View>
      )}
      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.secondary,
          pressed && styles.pressed,
          { borderColor: primary },
        ]}
        onPress={handleRestore}
        disabled={restoring}
      >
        <Text style={[styles.secondaryText, { color: primary }]}>
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
  pricing: { marginBottom: 24, alignItems: "stretch", gap: 12 },
  price: { fontSize: 28, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  priceYear: { fontSize: 16, opacity: 0.8, textAlign: "center", marginBottom: 16 },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  primary: {},
  primaryText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  secondary: { borderWidth: 2 },
  secondaryText: { fontSize: 17, fontWeight: "600" },
  pressed: { opacity: 0.8 },
  close: { marginTop: 24, alignItems: "center" },
  closeText: { fontSize: 16, opacity: 0.7 },
});
