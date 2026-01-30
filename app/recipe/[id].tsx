import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Pressable, ScrollView, Image } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { useRecipes } from "@/hooks/useRecipes";
import { createOrUpdateGroceryList } from "@/hooks/useGroceryList";
import { markCooked } from "@/hooks/useRecipes";
import {
  canUseCookTonight,
  incrementCookTonightUsage,
} from "@/lib/cookTonightUsage";
import { Text, View } from "@/components/Themed";

export default function RecipeDetailScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const { recipes, loading } = useRecipes(user?.id);
  const [cookedJustNow, setCookedJustNow] = useState(false);
  const [cookTonightAllowed, setCookTonightAllowed] = useState<boolean | null>(
    null
  );

  const recipe = recipes.find((r) => r.id === id);
  const isCookingMode = mode === "cooking";

  useEffect(() => {
    canUseCookTonight(isPremium).then(setCookTonightAllowed);
  }, [isPremium]);

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
            <View key={i} style={styles.stepRow}>
              <Text style={styles.stepNum}>{i + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
          <Pressable
            style={({ pressed }) => [
              styles.doneCooking,
              pressed && styles.btnPressed,
            ]}
            onPress={() => router.back()}
          >
            <Text style={styles.doneCookingText}>Done cooking</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  const handleAddToGroceryList = async () => {
    if (!user?.id) return;
    await createOrUpdateGroceryList(user.id, recipe.ingredients, recipe.id);
    router.push("/(tabs)/list");
  };

  const handleCookTonight = async () => {
    if (!user?.id) return;
    const allowed = cookTonightAllowed ?? (await canUseCookTonight(isPremium));
    if (!allowed) {
      router.push("/paywall");
      return;
    }
    if (!isPremium) await incrementCookTonightUsage();
    await createOrUpdateGroceryList(user.id, recipe.ingredients, recipe.id);
    router.push("/(tabs)/list");
  };

  const handleCookedIt = async () => {
    const ok = await markCooked(recipe.id);
    if (ok) setCookedJustNow(true);
  };

  const handleStartCooking = () => {
    router.push({
      pathname: `/recipe/${recipe.id}`,
      params: { mode: "cooking" },
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
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              styles.btnPrimary,
              pressed && styles.btnPressed,
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
            ]}
            onPress={handleCookTonight}
          >
            <Text style={styles.btnSecondaryText}>Cook Tonight</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              styles.btnOutline,
              pressed && styles.btnPressed,
            ]}
            onPress={handleStartCooking}
          >
            <Text style={styles.btnOutlineText}>Start Cooking</Text>
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
  btn: { paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  btnPressed: { opacity: 0.8 },
  btnPrimary: { backgroundColor: "#2f95dc" },
  btnPrimaryText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  btnSecondary: { backgroundColor: "rgba(47,149,220,0.2)" },
  btnSecondaryText: { color: "#2f95dc", fontSize: 17, fontWeight: "600" },
  btnOutline: { borderWidth: 2, borderColor: "#2f95dc" },
  btnOutlineText: { color: "#2f95dc", fontSize: 17, fontWeight: "600" },
  btnGhost: {},
  btnGhostText: { fontSize: 16, opacity: 0.8 },
  cookingContent: { padding: 24, paddingBottom: 48 },
  cookingTitle: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  cookingSubtitle: {
    fontSize: 15,
    fontWeight: "600",
    opacity: 0.8,
    marginTop: 16,
    marginBottom: 12,
  },
  stepRow: { flexDirection: "row", marginBottom: 16, alignItems: "flex-start" },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#2f95dc",
    color: "#fff",
    textAlign: "center",
    lineHeight: 28,
    fontWeight: "700",
    marginRight: 12,
  },
  stepText: { flex: 1, fontSize: 16, lineHeight: 24 },
  doneCooking: {
    marginTop: 32,
    paddingVertical: 16,
    backgroundColor: "#2f95dc",
    borderRadius: 12,
    alignItems: "center",
  },
  doneCookingText: { color: "#fff", fontSize: 17, fontWeight: "600" },
});
