import { useRouter } from "expo-router";
import { StyleSheet, Pressable, FlatList, Image } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useRecipes } from "@/hooks/useRecipes";
import { useSubscription } from "@/context/SubscriptionContext";
import { FREE_RECIPE_LIMIT } from "@/constants/limits";
import { Text, View } from "@/components/Themed";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const { recipes, loading } = useRecipes(user?.id);
  const canSaveMore = isPremium || recipes.length < FREE_RECIPE_LIMIT;

  const handlePaste = () => {
    if (!canSaveMore) {
      router.push("/paywall");
      return;
    }
    router.push("/paste");
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={handlePaste}
      >
        <Text style={styles.fabText}>Paste recipe link</Text>
      </Pressable>

      {loading ? (
        <Text style={styles.placeholder}>Loading recipes…</Text>
      ) : recipes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            You're one list away from dinner.
          </Text>
          <Text style={styles.emptySubtitle}>
            Paste any recipe link to get a clean recipe and grocery list.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.emptyButton,
              pressed && styles.fabPressed,
            ]}
            onPress={handlePaste}
          >
            <Text style={styles.fabText}>Paste your first recipe</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
              onPress={() => router.push(`/recipe/${item.id}`)}
            >
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.cardImage}
                />
              ) : (
                <View style={styles.cardImagePlaceholder} />
              )}
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.cookedAt && (
                  <Text style={styles.cookedBadge}>Cooked it</Text>
                )}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fab: {
    margin: 16,
    padding: 16,
    backgroundColor: "#2f95dc",
    borderRadius: 12,
    alignItems: "center",
  },
  fabPressed: { opacity: 0.8 },
  fabText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  placeholder: {
    padding: 24,
    textAlign: "center",
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    opacity: 0.8,
    textAlign: "center",
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: "#2f95dc",
    borderRadius: 12,
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    flexDirection: "row",
    backgroundColor: "rgba(128,128,128,0.1)",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  cardPressed: { opacity: 0.9 },
  cardImage: {
    width: 100,
    height: 100,
    backgroundColor: "#eee",
  },
  cardImagePlaceholder: {
    width: 100,
    height: 100,
    backgroundColor: "#e0e0e0",
  },
  cardContent: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  cookedBadge: {
    marginTop: 4,
    fontSize: 13,
    opacity: 0.7,
  },
});
