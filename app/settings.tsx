import * as React from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Pressable, Alert } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { Text, View } from "@/components/Themed";

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { isPremium, restorePurchases } = useSubscription();
  const [restoring, setRestoring] = React.useState(false);

  const handleRestore = async () => {
    setRestoring(true);
    const ok = await restorePurchases();
    setRestoring(false);
    if (ok) Alert.alert("Restored", "Your subscription has been restored.");
    else
      Alert.alert(
        "No subscription found",
        "We couldn't find a subscription to restore."
      );
  };

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {!isPremium && (
        <>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => router.push("/paywall")}
          >
            <Text style={styles.rowTitle}>Unlock premium</Text>
            <Text style={styles.rowSubtitle}>
              Unlimited recipes & Cook Tonight
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={handleRestore}
            disabled={restoring}
          >
            <Text style={styles.rowTitle}>
              {restoring ? "Restoring…" : "Restore purchases"}
            </Text>
          </Pressable>
        </>
      )}
      {user && (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={handleSignOut}
        >
          <Text style={[styles.rowTitle, styles.danger]}>Sign out</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  row: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.3)",
  },
  rowPressed: { opacity: 0.7 },
  rowTitle: { fontSize: 17, fontWeight: "600" },
  rowSubtitle: { fontSize: 14, opacity: 0.7, marginTop: 2 },
  danger: { color: "#c00" },
});
