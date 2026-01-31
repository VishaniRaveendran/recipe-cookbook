import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { StyleSheet, Pressable, ScrollView, Image, Alert } from "react-native";
import {
  activateKeepAwake,
  deactivateKeepAwake,
} from "expo-keep-awake";
import { CheckSquare, Square } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import {
  useRecipes,
  recipesQueryKey,
} from "@/hooks/useRecipes";
import {
  createOrUpdateGroceryList,
  groceryListQueryKey,
} from "@/hooks/useGroceryList";
import { markCooked } from "@/hooks/useRecipes";
import {
  canUseCookTonight,
  incrementCookTonightUsage,
} from "@/lib/cookTonightUsage";
import { scaleIngredientAmounts } from "@/lib/scaleIngredients";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Text, View } from "@/components/Themed";

export default function RecipeDetailScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const { recipes, loading } = useRecipes(user?.id);
  const [cookedJustNow, setCookedJustNow] = useState(false);
  const [cookTonightAllowed, setCookTonightAllowed] = useState<boolean | null>(
    null
  );
  const [groceryScale, setGroceryScale] = useState<1 | 2 | 4>(1);
  const [stepChecked, setStepChecked] = useState<Record<number, boolean>>({});

  const recipe = recipes.find((r) => r.id === id);
  const isCookingMode = mode === "cooking";
  const colorScheme = useColorScheme();
  const primary = Colors[colorScheme ?? "light"].primary ?? Colors[colorScheme ?? "light"].tint;

  const toggleStep = useCallback((i: number) => {
    setStepChecked((prev) => ({ ...prev, [i]: !prev[i] }));
  }, []);

  useEffect(() => {
    canUseCookTonight(isPremium).then(setCookTonightAllowed);
  }, [isPremium]);

  useEffect(() => {
    if (!isCookingMode) return;
    activateKeepAwake();
    return () => {
      deactivateKeepAwake();
    };
  }, [isCookingMode]);

  if (loading && !recipe) {
    return (
      <View style={styles.container}>
        <Text style={styles.placeholder}>Loading…</Text>
      </View>
    );
  }
  if (!recipe) {
    return (
      <View style={styles.container}>
        <Text style={styles.placeholder}>Recipe not found.</Text>
      </View>
    );
  }

  if (isCookingMode) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.cookingContent}>
          <Text style={styles.cookingTitle}>{recipe.title}</Text>
          <Text style={styles.cookingSubtitle}>Steps</Text>
          {recipe.steps.map((step, i) => (
            <Pressable
              key={i}
              style={styles.stepRow}
              onPress={() => toggleStep(i)}
            >
              <View style={styles.stepCheckbox}>
                {stepChecked[i] ? (
                  <CheckSquare size={28} color={primary} strokeWidth={2} />
                ) : (
                  <Square size={28} color={primary} strokeWidth={2} />
                )}
              </View>
              <Text
                style={[
                  styles.stepText,
                  stepChecked[i] && styles.stepTextChecked,
                ]}
              >
                {step}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={({ pressed }) => [
              styles.doneCooking,
              pressed && styles.btnPressed,
              { backgroundColor: primary },
            ]}
            onPress={() => router.back()}
          >
            <Text style={styles.doneCookingText}>Done cooking</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  const scaledIngredients = scaleIngredientAmounts(
    recipe.ingredients,
    groceryScale
  );

  const handleAddToGroceryList = async () => {
    if (!user?.id) {
      Alert.alert("Please wait", "Signing you in… Try again in a moment.");
      return;
    }
    const { error } = await createOrUpdateGroceryList(
      user.id,
      scaledIngredients,
      recipe.id
    );
    if (error) {
      Alert.alert("Could not add to grocery list", error);
      return;
    }
    queryClient.invalidateQueries({
      queryKey: groceryListQueryKey(user?.id),
    });
    router.push("/(tabs)/list");
  };

  const handleCookTonight = async () => {
    if (!user?.id) {
      Alert.alert("Please wait", "Signing you in… Try again in a moment.");
      return;
    }
    const allowed = cookTonightAllowed ?? (await canUseCookTonight(isPremium));
    if (!allowed) {
      router.push("/paywall");
      return;
    }
    if (!isPremium) await incrementCookTonightUsage();
    const { error } = await createOrUpdateGroceryList(
      user.id,
      scaledIngredients,
      recipe.id
    );
    if (error) {
      Alert.alert("Could not add to grocery list", error);
      return;
    }
    queryClient.invalidateQueries({
      queryKey: groceryListQueryKey(user?.id),
    });
    router.push("/(tabs)/list");
  };

  const handleCookedIt = async () => {
    const ok = await markCooked(recipe.id);
    if (ok) {
      queryClient.invalidateQueries({
        queryKey: recipesQueryKey(user?.id),
      });
      setCookedJustNow(true);
    }
  };

  const handleStartCooking = () => {
    router.push({
      pathname: "/recipe/[id]",
      params: { id: recipe.id, mode: "cooking" },
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {recipe.imageUrl ? (
        <Image source={{ uri: recipe.imageUrl }} style={styles.hero} />
      ) : (
        <View style={styles.heroPlaceholder} />
      )}
      <View style={styles.body}>
        <Text style={styles.title}>{recipe.title}</Text>
        {(recipe.cookedAt || cookedJustNow) && (
          <Text style={styles.cookedBadge}>Cooked it</Text>
        )}

        <Text style={styles.sectionTitle}>Ingredients</Text>
        {recipe.ingredients.map((ing, i) => (
          <Text key={i} style={styles.ingredient}>
            • {ing}
          </Text>
        ))}

        {recipe.steps.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Steps</Text>
            {recipe.steps.map((step, i) => (
              <Text key={i} style={styles.step}>
                {i + 1}. {step}
              </Text>
            ))}
          </>
        )}

        <View style={styles.actions}>
          <Text style={styles.scaleLabel}>Servings for grocery list</Text>
          <View style={styles.scaleRow}>
            {([1, 2, 4] as const).map((s) => (
              <Pressable
                key={s}
                style={[
                  styles.scaleChip,
                  groceryScale === s && { backgroundColor: primary },
                ]}
                onPress={() => setGroceryScale(s)}
              >
                <Text
                  style={[
                    styles.scaleChipText,
                    groceryScale === s && styles.scaleChipTextActive,
                    groceryScale === s && { color: "#fff" },
                  ]}
                >
                  {s}x
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              styles.btnPrimary,
              pressed && styles.btnPressed,
              { backgroundColor: primary },
            ]}
            onPress={handleAddToGroceryList}
          >
            <Text style={styles.btnPrimaryText}>Add to Grocery List</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              styles.btnSecondary,
              pressed && styles.btnPressed,
              { borderColor: primary },
            ]}
            onPress={handleCookTonight}
          >
            <Text style={[styles.btnSecondaryText, { color: primary }]}>
              Cook Tonight
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              styles.btnOutline,
              pressed && styles.btnPressed,
              { borderColor: primary },
            ]}
            onPress={handleStartCooking}
          >
            <Text style={[styles.btnOutlineText, { color: primary }]}>
              Start Cooking
            </Text>
          </Pressable>
          {!recipe.cookedAt && !cookedJustNow && (
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnGhost,
                pressed && styles.btnPressed,
              ]}
              onPress={handleCookedIt}
            >
              <Text style={styles.btnGhostText}>Cooked it? Nice.</Text>
            </Pressable>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 32 },
  placeholder: { padding: 24, textAlign: "center" },
  hero: { width: "100%", height: 220, backgroundColor: "#eee" },
  heroPlaceholder: { width: "100%", height: 220, backgroundColor: "#e0e0e0" },
  body: { padding: 20 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  cookedBadge: { fontSize: 14, opacity: 0.7, marginBottom: 20 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 20,
    marginBottom: 8,
  },
  ingredient: { fontSize: 16, lineHeight: 24, marginBottom: 4 },
  step: { fontSize: 16, lineHeight: 24, marginBottom: 8 },
  actions: { marginTop: 28, gap: 12 },
  scaleLabel: { fontSize: 15, fontWeight: "600", marginBottom: 8 },
  scaleRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  scaleChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.15)",
  },
  scaleChipText: { fontSize: 16, fontWeight: "600" },
  scaleChipTextActive: {},
  btn: { paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  btnPressed: { opacity: 0.8 },
  btnPrimary: {},
  btnPrimaryText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  btnSecondary: { backgroundColor: "rgba(232,93,4,0.15)", borderWidth: 2 },
  btnSecondaryText: { fontSize: 17, fontWeight: "600" },
  btnOutline: { borderWidth: 2 },
  btnOutlineText: { fontSize: 17, fontWeight: "600" },
  btnGhost: {},
  btnGhostText: { fontSize: 16, opacity: 0.8 },
  cookingContent: { padding: 24, paddingBottom: 48, maxWidth: 600 },
  cookingTitle: { fontSize: 28, fontWeight: "700", marginBottom: 12 },
  cookingSubtitle: {
    fontSize: 17,
    fontWeight: "600",
    opacity: 0.8,
    marginTop: 20,
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: "row",
    marginBottom: 20,
    alignItems: "flex-start",
  },
  stepCheckbox: { marginRight: 12, marginTop: 2 },
  stepText: { flex: 1, fontSize: 21, lineHeight: 30 },
  stepTextChecked: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  doneCooking: {
    marginTop: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  doneCookingText: { color: "#fff", fontSize: 17, fontWeight: "600" },
});
