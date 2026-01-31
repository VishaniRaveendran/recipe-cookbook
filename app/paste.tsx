import { useRouter } from "expo-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Image,
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
import { parseRecipeFromUrl, parseManualIngredients } from "@/lib/recipeParser";
import {
  canUseSmartImporter,
  incrementSmartImporterUsage,
} from "@/lib/smartImporterUsage";
import { FREE_RECIPE_LIMIT } from "@/constants/limits";
import type { ParsedRecipe } from "@/types";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { Text, View } from "@/components/Themed";

export default function PasteScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isPremium, isPro, hasRecipePack } = useSubscription();
  const { recipes } = useRecipes(user?.id);
  const [url, setUrl] = useState("");
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualIngredients, setManualIngredients] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [showManual, setShowManual] = useState(false);

  const colorScheme = useColorScheme();
  const primary =
    Colors[colorScheme ?? "light"].primary ??
    Colors[colorScheme ?? "light"].tint;
  const atRecipeLimit = !isPremium && recipes.length >= FREE_RECIPE_LIMIT;

  const handleParse = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const allowed = await canUseSmartImporter(isPro, hasRecipePack);
    if (!allowed) {
      router.push("/paywall");
      return;
    }
    setLoading(true);
    setParsed(null);
    try {
      const result = await parseRecipeFromUrl(trimmed);
      if (!result) {
        setShowManual(true);
        setManualTitle("");
        setParsed({ title: "Untitled Recipe", ingredients: [], steps: [] });
        return;
      }
      await incrementSmartImporterUsage();
      setParsed(result);
      setManualTitle(result.title || "");
      setShowManual(result.ingredients.length === 0);
    } catch {
      setShowManual(true);
      setManualTitle("");
      setParsed({ title: "Untitled Recipe", ingredients: [], steps: [] });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndAddToList = async () => {
    if (!parsed) return;
    if (!user) {
      Alert.alert(
        "Please wait",
        "Signing you in… Try again in a moment, or check your internet connection."
      );
      return;
    }
    if (atRecipeLimit) {
      router.push("/paywall");
      return;
    }
    const ingredients =
      showManual && manualIngredients.trim()
        ? parseManualIngredients(manualIngredients)
        : parsed.ingredients;
    const titleToSave =
      showManual && manualTitle.trim()
        ? manualTitle.trim()
        : parsed.title || "Untitled Recipe";
    if (ingredients.length === 0 && !titleToSave.trim()) {
      Alert.alert("Add a title or ingredients", "Add at least a title or ingredients, or save the link and add ingredients later.");
      return;
    }
    setLoading(true);
    try {
      const { recipe, error: recipeError } = await insertRecipe(user.id, {
        sourceUrl: url.trim() || "manual",
        title: titleToSave,
        imageUrl: parsed.imageUrl,
        ingredients,
        steps: parsed.steps,
      });
      if (recipeError) {
        Alert.alert("Could not save recipe", recipeError);
        return;
      }
      if (!recipe) return;
      queryClient.invalidateQueries({ queryKey: recipesQueryKey(user.id) });
      const categoryByIngredient: CategoryByIngredient | undefined =
        parsed.groceryByAisle?.length
          ? (() => {
              const m: Record<string, string> = {};
              for (const g of parsed.groceryByAisle)
                for (const name of g.items)
                  m[name.trim().toLowerCase()] = g.aisle;
              return m;
            })()
          : undefined;
      const { error: listError } = await createOrUpdateGroceryList(
        user.id,
        ingredients,
        recipe.id,
        categoryByIngredient
      );
      if (listError) {
        Alert.alert("Recipe saved, but grocery list failed", listError);
      }
      queryClient.invalidateQueries({
        queryKey: groceryListQueryKey(user.id),
      });
      router.back();
      router.push("/(tabs)/list");
    } catch (e) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Could not save recipe."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOnly = async () => {
    if (!parsed) return;
    if (!user) {
      Alert.alert(
        "Please wait",
        "Signing you in… Try again in a moment, or check your internet connection."
      );
      return;
    }
    if (atRecipeLimit) {
      router.push("/paywall");
      return;
    }
    const ingredients =
      showManual && manualIngredients.trim()
        ? parseManualIngredients(manualIngredients)
        : parsed.ingredients;
    const titleToSave =
      showManual && manualTitle.trim()
        ? manualTitle.trim()
        : parsed.title || "Untitled Recipe";
    setLoading(true);
    try {
      const { recipe, error: recipeError } = await insertRecipe(user.id, {
        sourceUrl: url.trim() || "manual",
        title: titleToSave,
        imageUrl: parsed.imageUrl,
        ingredients,
        steps: parsed.steps,
      });
      if (recipeError) {
        Alert.alert("Could not save recipe", recipeError);
        return;
      }
      if (recipe) {
        queryClient.invalidateQueries({ queryKey: recipesQueryKey(user.id) });
        router.back();
        router.push(`/recipe/${recipe.id}`);
      }
    } catch (e) {
      Alert.alert(
        "Error",
        e instanceof Error ? e.message : "Could not save recipe."
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text?.trim()) {
        const lines = parseManualIngredients(text);
        setManualIngredients(lines.join("\n"));
      } else {
        Alert.alert("Clipboard empty", "Copy ingredients from the video or another app, then tap Paste from clipboard.");
      }
    } catch {
      Alert.alert("Could not read clipboard", "Make sure the app has permission to access the clipboard.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Paste any recipe or video link</Text>
      <TextInput
        style={styles.input}
        placeholder="TikTok, Instagram, YouTube, or website URL"
        placeholderTextColor="#999"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />
      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.primary,
          loading && styles.disabled,
          pressed && styles.pressed,
          { backgroundColor: primary },
        ]}
        onPress={handleParse}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>Get recipe</Text>
        )}
      </Pressable>

      {parsed && (
        <ScrollView
          style={styles.preview}
          contentContainerStyle={styles.previewContent}
        >
          {parsed.imageUrl ? (
            <Image
              source={{ uri: parsed.imageUrl }}
              style={styles.previewImage}
            />
          ) : (
            <View style={styles.previewImagePlaceholder} />
          )}
          {showManual ? (
            <>
              <Text style={styles.sectionLabel}>Recipe name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Chocolate Cake"
                placeholderTextColor="#999"
                value={manualTitle}
                onChangeText={setManualTitle}
                editable={!loading}
              />
              <Text style={styles.manualHint}>
                {parsed?.error
                  ? parsed.error
                  : "No ingredients were found. You can copy ingredients from the video description or another app and paste them below. You can also save the link now and add ingredients later."}
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.secondary,
                  pressed && styles.pressed,
                  { borderColor: primary },
                ]}
                onPress={handlePasteFromClipboard}
                disabled={loading}
              >
                <Text style={[styles.secondaryText, { color: primary }]}>
                  Paste from clipboard
                </Text>
              </Pressable>
              <Text style={styles.sectionLabel}>
                Ingredients (one per line)
              </Text>
              <TextInput
                style={styles.textArea}
                placeholder="e.g. 2 cups flour\n1 tsp salt"
                placeholderTextColor="#999"
                value={manualIngredients}
                onChangeText={setManualIngredients}
                multiline
                numberOfLines={6}
              />
            </>
          ) : parsed.groceryByAisle?.length ? (
            <>
              <Text style={styles.previewTitle}>{parsed.title}</Text>
              <Text style={styles.sectionLabel}>
                Grocery list (by supermarket aisle)
              </Text>
              {parsed.groceryByAisle.map((g) => (
                <View key={g.aisle} style={styles.aisleBlock}>
                  <Text style={styles.aisleTitle}>{g.aisle}</Text>
                  {g.items.map((ing, i) => (
                    <Text key={`${g.aisle}-${i}`} style={styles.ingredient}>
                      • {ing}
                    </Text>
                  ))}
                </View>
              ))}
            </>
          ) : (
            <>
              <Text style={styles.previewTitle}>{parsed.title}</Text>
              <Text style={styles.sectionLabel}>Ingredients</Text>
              {parsed.ingredients.map((ing, i) => (
                <Text key={i} style={styles.ingredient}>
                  • {ing}
                </Text>
              ))}
            </>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.primary,
              loading && styles.disabled,
              pressed && styles.pressed,
              { backgroundColor: primary },
            ]}
            onPress={handleSaveAndAddToList}
            disabled={loading}
          >
            <Text style={styles.primaryText}>Save & Add to Grocery List</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.secondary,
              pressed && styles.pressed,
              { borderColor: primary },
            ]}
            onPress={handleSaveOnly}
            disabled={loading}
          >
            <Text style={[styles.secondaryText, { color: primary }]}>
              Save recipe only
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  label: { fontSize: 17, fontWeight: "600", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  primary: {},
  primaryText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 2,
  },
  secondaryText: { fontSize: 17, fontWeight: "600" },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.8 },
  preview: { flex: 1, marginTop: 20 },
  previewContent: { paddingBottom: 32 },
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#eee",
    marginBottom: 12,
  },
  previewImagePlaceholder: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#e0e0e0",
    marginBottom: 12,
  },
  previewTitle: { fontSize: 22, fontWeight: "700", marginBottom: 16 },
  manualHint: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 12,
    lineHeight: 20,
  },
  sectionLabel: { fontSize: 15, fontWeight: "600", marginBottom: 8 },
  aisleBlock: { marginBottom: 16 },
  aisleTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "capitalize",
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  ingredient: { fontSize: 16, marginBottom: 4 },
});
