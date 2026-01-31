import { useRouter } from "expo-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { useRecipes, insertRecipe, recipesQueryKey } from "@/hooks/useRecipes";
import {
  createOrUpdateGroceryList,
  groceryListQueryKey,
  type CategoryByIngredient,
} from "@/hooks/useGroceryList";
import { parseRecipeFromUrl } from "@/lib/recipeParser";
import {
  canUseSmartImporter,
  incrementSmartImporterUsage,
} from "@/lib/smartImporterUsage";
import { FREE_RECIPE_LIMIT } from "@/constants/limits";
import type { ParsedRecipe } from "@/types";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Text, View } from "@/components/Themed";

/** Extract URLs from text (one per line or space-separated). */
function extractUrls(text: string): string[] {
  const lines = text
    .split(/\n/)
    .flatMap((line) => line.split(/\s+/))
    .map((s) => s.trim())
    .filter((s) => s.startsWith("http://") || s.startsWith("https://"));
  const seen = new Set<string>();
  return lines.filter((url) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

/** Merge ingredients from multiple parsed recipes, dedupe by normalized name. */
function mergeIngredients(parsed: ParsedRecipe[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parsed) {
    for (const ing of p.ingredients ?? []) {
      const key = ing.trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        out.push(ing.trim());
      }
    }
  }
  return out;
}

export default function VideosToListScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isPremium, isPro, hasRecipePack } = useSubscription();
  const { recipes } = useRecipes(user?.id);
  const [urlsText, setUrlsText] = useState("");
  const [saveRecipes, setSaveRecipes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const colorScheme = useColorScheme();
  const primary =
    Colors[colorScheme ?? "light"].primary ??
    Colors[colorScheme ?? "light"].tint;
  const atRecipeLimit = !isPremium && recipes.length >= FREE_RECIPE_LIMIT;

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text?.trim()) setUrlsText(text.trim());
      else
        Alert.alert(
          "Clipboard empty",
          "Copy one or more recipe or video URLs, then paste."
        );
    } catch {
      Alert.alert("Could not read clipboard", "Check app permissions.");
    }
  };

  const handleGenerateList = async () => {
    const urls = extractUrls(urlsText);
    if (urls.length === 0) {
      Alert.alert(
        "No URLs",
        "Enter or paste at least one recipe or video URL (one per line)."
      );
      return;
    }
    const allowed = await canUseSmartImporter(isPro, hasRecipePack);
    if (!allowed) {
      router.push("/paywall");
      return;
    }
    if (!user?.id) {
      Alert.alert(
        "Please sign in",
        "You need to be signed in to create a grocery list."
      );
      return;
    }
    if (saveRecipes && atRecipeLimit) {
      router.push("/paywall");
      return;
    }

    setLoading(true);
    setProgress(`Parsing 1 of ${urls.length}…`);
    const parsedWithUrls: { url: string; recipe: ParsedRecipe }[] = [];
    let lastError: string | null = null;
    for (let i = 0; i < urls.length; i++) {
      setProgress(`Parsing ${i + 1} of ${urls.length}…`);
      try {
        const result = await parseRecipeFromUrl(urls[i]);
        if (result?.error) lastError = result.error;
        if (
          result &&
          (result.ingredients?.length > 0 || result.steps?.length > 0)
        ) {
          await incrementSmartImporterUsage();
          parsedWithUrls.push({ url: urls[i], recipe: result });
        }
      } catch {
        // skip failed URL
      }
    }

    const parsed = parsedWithUrls.map((p) => p.recipe);
    if (parsed.length === 0) {
      setLoading(false);
      setProgress(null);
      Alert.alert(
        "No recipes found",
        lastError ?? "We couldn't extract ingredients from the links. Try recipe or video URLs that include ingredients in the description."
      );
      return;
    }

    const ingredients = mergeIngredients(parsed);
    if (ingredients.length === 0) {
      setLoading(false);
      setProgress(null);
      Alert.alert(
        "No ingredients",
        "No ingredients were found in the parsed recipes."
      );
      return;
    }

    if (saveRecipes) {
      const toSave = atRecipeLimit
        ? 0
        : Math.min(parsedWithUrls.length, FREE_RECIPE_LIMIT - recipes.length);
      for (let i = 0; i < toSave && i < parsedWithUrls.length; i++) {
        const { url, recipe: p } = parsedWithUrls[i];
        await insertRecipe(user.id, {
          sourceUrl: url,
          title: p.title || "Recipe from link",
          imageUrl: p.imageUrl,
          ingredients: p.ingredients ?? [],
          steps: p.steps ?? [],
        });
      }
      if (toSave > 0) {
        queryClient.invalidateQueries({ queryKey: recipesQueryKey(user.id) });
      }
    }

    setProgress("Adding to grocery list…");
    const categoryByIngredient: CategoryByIngredient = {};
    for (const { recipe } of parsedWithUrls) {
      if (!recipe.groceryByAisle?.length) continue;
      for (const g of recipe.groceryByAisle) {
        for (const name of g.items) {
          const key = name.trim().toLowerCase();
          if (!categoryByIngredient[key]) categoryByIngredient[key] = g.aisle;
        }
      }
    }
    const { error } = await createOrUpdateGroceryList(
      user.id,
      ingredients,
      null,
      Object.keys(categoryByIngredient).length > 0
        ? categoryByIngredient
        : undefined
    );
    setLoading(false);
    setProgress(null);

    if (error) {
      Alert.alert("Could not update grocery list", error);
      return;
    }
    queryClient.invalidateQueries({ queryKey: groceryListQueryKey(user.id) });
    router.replace("/(tabs)/list");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Videos to grocery list</Text>
      <Text style={styles.subtitle}>
        Paste one or more recipe or video links (one per line). We’ll extract
        ingredients and build one grocery list.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="https://youtube.com/…&#10;https://example.com/recipe"
        placeholderTextColor="#999"
        value={urlsText}
        onChangeText={setUrlsText}
        multiline
        numberOfLines={6}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />

      <Pressable
        style={({ pressed }) => [
          styles.pasteBtn,
          pressed && styles.pasteBtnPressed,
        ]}
        onPress={handlePasteFromClipboard}
        disabled={loading}
      >
        <Text style={styles.pasteBtnText}>Paste from clipboard</Text>
      </Pressable>

      <View style={styles.checkRow}>
        <Pressable
          style={({ pressed }) => [
            styles.checkbox,
            saveRecipes && styles.checkboxChecked,
            { borderColor: primary },
            saveRecipes && { backgroundColor: primary },
            pressed && styles.checkboxPressed,
          ]}
          onPress={() => setSaveRecipes((s) => !s)}
          disabled={loading}
        >
          {saveRecipes && <Text style={styles.checkmark}>✓</Text>}
        </Pressable>
        <Text style={styles.checkLabel}>Save recipes to my cookbook</Text>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.primary,
          loading && styles.disabled,
          pressed && styles.pressed,
          { backgroundColor: primary },
        ]}
        onPress={handleGenerateList}
        disabled={loading}
      >
        {loading ? (
          <View style={styles.buttonRow}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.primaryText}>{progress ?? "Parsing…"}</Text>
          </View>
        ) : (
          <Text style={styles.primaryText}>Generate grocery list</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 15, opacity: 0.85, marginBottom: 20 },
  input: {
    fontSize: 15,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(128,128,128,0.4)",
    borderRadius: 12,
    minHeight: 140,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  pasteBtn: { alignSelf: "flex-start", marginBottom: 20 },
  pasteBtnPressed: { opacity: 0.7 },
  pasteBtnText: { fontSize: 15, opacity: 0.9 },
  checkRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {},
  checkboxPressed: { opacity: 0.8 },
  checkmark: { color: "#fff", fontSize: 14, fontWeight: "700" },
  checkLabel: { fontSize: 16 },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  primary: {},
  primaryText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  buttonRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  disabled: { opacity: 0.7 },
  pressed: { opacity: 0.9 },
});
