import { useRouter } from "expo-router";
import { useState } from "react";
import {
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { useRecipes, insertRecipe } from "@/hooks/useRecipes";
import { createOrUpdateGroceryList } from "@/hooks/useGroceryList";
import { parseRecipeFromUrl, parseManualIngredients } from "@/lib/recipeParser";
import { FREE_RECIPE_LIMIT } from "@/constants/limits";
import type { ParsedRecipe } from "@/types";
import { Text, View } from "@/components/Themed";

export default function PasteScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const { recipes } = useRecipes(user?.id);
  const [url, setUrl] = useState("");
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualIngredients, setManualIngredients] = useState("");
  const [showManual, setShowManual] = useState(false);

  const atRecipeLimit = !isPremium && recipes.length >= FREE_RECIPE_LIMIT;

  const handleParse = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setParsed(null);
    try {
      const result = await parseRecipeFromUrl(trimmed);
      if (!result) {
        setShowManual(true);
        setParsed({ title: "Untitled Recipe", ingredients: [], steps: [] });
        return;
      }
      setParsed(result);
      // When we couldn't extract ingredients (e.g. YouTube, Instagram), show manual entry
      setShowManual(result.ingredients.length === 0);
    } catch {
      setShowManual(true);
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
    if (ingredients.length === 0 && !parsed.title) {
      Alert.alert("Add ingredients", "Add at least a title or ingredients.");
      return;
    }
    setLoading(true);
    try {
      const { recipe, error: recipeError } = await insertRecipe(user.id, {
        sourceUrl: url.trim() || "manual",
        title: parsed.title || "Untitled Recipe",
        imageUrl: parsed.imageUrl,
        ingredients,
        steps: parsed.steps,
      });
      if (recipeError) {
        Alert.alert("Could not save recipe", recipeError);
        return;
      }
      if (!recipe) return;
      const { error: listError } = await createOrUpdateGroceryList(
        user.id,
        ingredients,
        recipe.id
      );
      if (listError) {
        Alert.alert("Recipe saved, but grocery list failed", listError);
      }
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
    setLoading(true);
    try {
      const { recipe, error: recipeError } = await insertRecipe(user.id, {
        sourceUrl: url.trim() || "manual",
        title: parsed.title || "Untitled Recipe",
        imageUrl: parsed.imageUrl,
        ingredients,
        steps: parsed.steps,
      });
      if (recipeError) {
        Alert.alert("Could not save recipe", recipeError);
        return;
      }
      if (recipe) {
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

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Paste any recipe link</Text>
      <TextInput
        style={styles.input}
        placeholder="Instagram, YouTube, or website URL"
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
          <Text style={styles.previewTitle}>{parsed.title}</Text>
          {showManual ? (
            <>
              <Text style={styles.manualHint}>
                No ingredients were found. Paste the recipe name above and
                ingredients below (from the video or page). For auto-extract,
                set EXPO_PUBLIC_PARSER_API_URL in .env — see SETUP.md.
              </Text>
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
          ) : (
            <>
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
            ]}
            onPress={handleSaveOnly}
            disabled={loading}
          >
            <Text style={styles.secondaryText}>Save recipe only</Text>
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
  primary: { backgroundColor: "#2f95dc" },
  primaryText: { color: "#fff", fontSize: 17, fontWeight: "600" },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#2f95dc",
  },
  secondaryText: { color: "#2f95dc", fontSize: 17, fontWeight: "600" },
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
