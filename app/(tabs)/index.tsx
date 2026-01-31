import { useRouter, Link } from "expo-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { StyleSheet, Pressable, FlatList, Image, Alert } from "react-native";
import { CheckSquare, Square } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useRecipes } from "@/hooks/useRecipes";
import {
  createOrUpdateGroceryList,
  groceryListQueryKey,
} from "@/hooks/useGroceryList";
import { useSubscription } from "@/context/SubscriptionContext";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { FREE_RECIPE_LIMIT } from "@/constants/limits";
import { Text, View } from "@/components/Themed";

function mergeIngredientsFromRecipes(
  recipes: { id: string; ingredients: string[] }[],
  selectedIds: Set<string>
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of recipes) {
    if (!selectedIds.has(r.id)) continue;
    for (const ing of r.ingredients) {
      const key = ing.trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        out.push(ing.trim());
      }
    }
  }
  return out;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const queryClient = useQueryClient();
  const { recipes, loading } = useRecipes(user?.id);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const canSaveMore = isPremium || recipes.length < FREE_RECIPE_LIMIT;
  const colorScheme = useColorScheme();
  const primary = Colors[colorScheme ?? "light"].primary ?? Colors[colorScheme ?? "light"].tint;

  const handlePaste = () => {
    if (!canSaveMore) {
      router.push("/paywall");
      return;
    }
    router.push("/paste");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddSelectedToList = async () => {
    if (!user?.id || selectedIds.size === 0) return;
    const merged = mergeIngredientsFromRecipes(recipes, selectedIds);
    if (merged.length === 0) {
      Alert.alert("No ingredients", "Selected recipes have no ingredients.");
      return;
    }
    setAdding(true);
    const { error } = await createOrUpdateGroceryList(user.id, merged, null);
    setAdding(false);
    if (error) {
      Alert.alert("Could not add to grocery list", error);
      return;
    }
    queryClient.invalidateQueries({
      queryKey: groceryListQueryKey(user?.id),
    });
    setSelectionMode(false);
    setSelectedIds(new Set());
    router.push("/(tabs)/list");
  };

  return (
    <View style={styles.container}>
      {!selectionMode ? (
        <View style={styles.fabRow}>
          <Pressable
            style={({ pressed }) => [
              styles.fab,
              pressed && styles.fabPressed,
              { backgroundColor: primary },
            ]}
            onPress={handlePaste}
          >
            <Text style={styles.fabText}>Paste recipe link</Text>
          </Pressable>
          <Link href="/videos-to-list" asChild>
            <Pressable
              style={({ pressed }) => [
                styles.fabSecondary,
                pressed && styles.fabPressed,
                { borderColor: primary },
              ]}
            >
              <Text style={[styles.fabSecondaryText, { color: primary }]}>
                Videos to grocery list
              </Text>
            </Pressable>
          </Link>
          <Link href="/identify-ingredients" asChild>
            <Pressable
              style={({ pressed }) => [
                styles.fabSecondary,
                pressed && styles.fabPressed,
                { borderColor: primary },
              ]}
            >
              <Text style={[styles.fabSecondaryText, { color: primary }]}>
                Identify ingredients from photo or video
              </Text>
            </Pressable>
          </Link>
        </View>
      ) : (
        <View style={styles.selectionBar}>
          <Pressable
            style={({ pressed }) => [
              styles.selectBtn,
              pressed && styles.fabPressed,
              { borderColor: primary },
            ]}
            onPress={() => {
              setSelectionMode(false);
              setSelectedIds(new Set());
            }}
          >
            <Text style={[styles.selectBtnText, { color: primary }]}>Cancel</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.selectBtn,
              styles.selectBtnPrimary,
              pressed && styles.fabPressed,
              { backgroundColor: primary },
            ]}
            onPress={handleAddSelectedToList}
            disabled={selectedIds.size === 0 || adding}
          >
            <Text style={styles.fabText}>
              {adding ? "Adding…" : `Add ${selectedIds.size} to list`}
            </Text>
          </Pressable>
        </View>
      )}

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
              { backgroundColor: primary },
            ]}
            onPress={handlePaste}
          >
            <Text style={styles.fabText}>Paste your first recipe</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {!selectionMode && (
            <Pressable
              style={({ pressed }) => [
                styles.selectModeTrigger,
                pressed && styles.fabPressed,
                { borderColor: primary },
              ]}
              onPress={() => setSelectionMode(true)}
            >
              <Text style={[styles.selectModeTriggerText, { color: primary }]}>
                Select recipes for grocery list
              </Text>
            </Pressable>
          )}
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
                onPress={() =>
                  selectionMode
                    ? toggleSelect(item.id)
                    : router.push(`/recipe/${item.id}`)
                }
              >
                {selectionMode && (
                  <View style={styles.cardCheckbox}>
                    {selectedIds.has(item.id) ? (
                      <CheckSquare size={24} color={primary} strokeWidth={2} />
                    ) : (
                      <Square size={24} color={primary} strokeWidth={2} />
                    )}
                  </View>
                )}
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
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fabRow: { margin: 16, gap: 10 },
  fab: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  fabSecondary: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
  },
  fabSecondaryText: { fontSize: 16, fontWeight: "600" },
  fabPressed: { opacity: 0.8 },
  fabText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  selectionBar: {
    flexDirection: "row",
    margin: 16,
    gap: 12,
  },
  selectBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
  },
  selectBtnPrimary: {},
  selectBtnText: { fontSize: 17, fontWeight: "600" },
  selectModeTrigger: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
  },
  selectModeTriggerText: { fontSize: 16, fontWeight: "600" },
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
    alignItems: "center",
  },
  cardCheckbox: { paddingLeft: 12, paddingRight: 8 },
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
