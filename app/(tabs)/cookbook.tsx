import { useMemo } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useRecipes } from "@/hooks/useRecipes";
import { useKitchenInventory } from "@/hooks/useKitchenInventory";
import {
  createOrUpdateGroceryList,
  groceryListQueryKey,
} from "@/hooks/useGroceryList";
import {
  matchRecipesToFridge,
  sortRecipeMatches,
  type RecipeMatch,
} from "@/lib/matchRecipesToFridge";
import { Text, View } from "@/components/Themed";

const SECTION_LABELS: Record<RecipeMatch["level"], string> = {
  can_make: "You can make",
  almost: "Almost have it",
  need_more: "Need more",
};

export default function CookbookScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { recipes, loading: recipesLoading } = useRecipes(user?.id);
  const { inventory, loading: inventoryLoading } = useKitchenInventory(user?.id);
  const colorScheme = useColorScheme();
  const primary =
    Colors[colorScheme ?? "light"].primary ?? Colors[colorScheme ?? "light"].tint;

  const matches = useMemo(() => {
    const fridgeItems = inventory?.items ?? [];
    const raw = matchRecipesToFridge(recipes, fridgeItems);
    return sortRecipeMatches(raw);
  }, [recipes, inventory?.items]);

  const byLevel = useMemo(() => {
    const out: Record<RecipeMatch["level"], RecipeMatch[]> = {
      can_make: [],
      almost: [],
      need_more: [],
    };
    for (const m of matches) {
      out[m.level].push(m);
    }
    return out;
  }, [matches]);

  const handleAddMissingToList = async (match: RecipeMatch) => {
    if (!user?.id || match.missingIngredients.length === 0) return;
    const { error } = await createOrUpdateGroceryList(
      user.id,
      match.missingIngredients,
      match.recipe.id
    );
    if (error) {
      Alert.alert("Could not add to grocery list", error);
      return;
    }
    queryClient.invalidateQueries({
      queryKey: groceryListQueryKey(user.id),
    });
    router.push("/(tabs)/list");
  };

  const loading = recipesLoading || inventoryLoading;

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.placeholder}>Loading…</Text>
      </View>
    );
  }

  if (recipes.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Your cookbook is empty</Text>
          <Text style={styles.emptySubtitle}>
            Paste recipe links from the Recipes tab to build your cookbook. Then add what’s in your kitchen to see what you can make.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.emptyButton,
              pressed && styles.emptyButtonPressed,
              { backgroundColor: primary },
            ]}
            onPress={() => router.push("/(tabs)/index")}
          >
            <Text style={styles.emptyButtonText}>Go to Recipes</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const hasFridge = (inventory?.items?.length ?? 0) > 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {!hasFridge && (
        <Pressable
          style={({ pressed }) => [
            styles.fridgeCta,
            pressed && styles.fridgeCtaPressed,
            { borderColor: primary },
          ]}
          onPress={() => router.push("/(tabs)/fridge")}
        >
          <Text style={[styles.fridgeCtaText, { color: primary }]}>
            Add what’s in your kitchen to see what you can make
          </Text>
        </Pressable>
      )}

      {(["can_make", "almost", "need_more"] as const).map((level) => {
        const list = byLevel[level];
        if (list.length === 0) return null;
        return (
          <View key={level} style={styles.section}>
            <Text style={styles.sectionTitle}>{SECTION_LABELS[level]}</Text>
            {list.map((match) => (
              <View key={match.recipe.id} style={styles.card}>
                <Pressable
                  style={({ pressed }) => [
                    styles.cardTouchable,
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() => router.push(`/recipe/${match.recipe.id}`)}
                >
                  {match.recipe.imageUrl ? (
                    <Image
                      source={{ uri: match.recipe.imageUrl }}
                      style={styles.cardImage}
                    />
                  ) : (
                    <View style={styles.cardImagePlaceholder} />
                  )}
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {match.recipe.title}
                    </Text>
                    {match.recipe.cookedAt && (
                      <Text style={styles.cookedBadge}>Cooked it</Text>
                    )}
                    {match.missingIngredients.length > 0 && (
                      <Text
                        style={styles.missingText}
                        numberOfLines={2}
                      >
                        Missing: {match.missingIngredients.slice(0, 3).join(", ")}
                        {match.missingIngredients.length > 3
                          ? ` +${match.missingIngredients.length - 3} more`
                          : ""}
                      </Text>
                    )}
                  </View>
                </Pressable>
                {match.missingIngredients.length > 0 && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.addMissingBtn,
                      pressed && styles.addMissingBtnPressed,
                      { borderColor: primary },
                    ]}
                    onPress={() => handleAddMissingToList(match)}
                  >
                    <Text style={[styles.addMissingBtnText, { color: primary }]}>
                      Add missing to grocery list
                    </Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  placeholder: { padding: 24, textAlign: "center" },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: { fontSize: 20, fontWeight: "600", textAlign: "center", marginBottom: 8 },
  emptySubtitle: {
    fontSize: 15,
    opacity: 0.8,
    textAlign: "center",
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyButtonPressed: { opacity: 0.8 },
  emptyButtonText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  fridgeCta: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
  },
  fridgeCtaPressed: { opacity: 0.8 },
  fridgeCtaText: { fontSize: 15, fontWeight: "600" },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    textTransform: "uppercase",
    opacity: 0.8,
    marginBottom: 12,
  },
  card: {
    backgroundColor: "rgba(128,128,128,0.1)",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  cardTouchable: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardPressed: { opacity: 0.9 },
  cardImage: {
    width: 88,
    height: 88,
    backgroundColor: "#eee",
  },
  cardImagePlaceholder: {
    width: 88,
    height: 88,
    backgroundColor: "#e0e0e0",
  },
  cardContent: { flex: 1, padding: 12, justifyContent: "center" },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  cookedBadge: { marginTop: 2, fontSize: 12, opacity: 0.7 },
  missingText: { marginTop: 4, fontSize: 13, opacity: 0.85 },
  addMissingBtn: {
    marginHorizontal: 12,
    marginBottom: 10,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
  },
  addMissingBtnPressed: { opacity: 0.8 },
  addMissingBtnText: { fontSize: 14, fontWeight: "600" },
});
