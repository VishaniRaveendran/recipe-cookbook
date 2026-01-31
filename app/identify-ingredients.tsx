import { useState } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as VideoThumbnails from "expo-video-thumbnails";
import * as FileSystem from "expo-file-system";
import { useAuth } from "@/context/AuthContext";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { detectIngredientsFromImage } from "@/services/visionIngredients";
import {
  createOrUpdateGroceryList,
  groceryListQueryKey,
} from "@/hooks/useGroceryList";
import { addKitchenItem, kitchenInventoryQueryKey } from "@/hooks/useKitchenInventory";
import type { DetectedGroceryItem } from "@/types";
import { Text, View } from "@/components/Themed";

/** Merge multiple AI ingredient lists by name, keeping highest confidence per ingredient. */
function mergeDetectedIngredients(
  lists: DetectedGroceryItem[][]
): DetectedGroceryItem[] {
  const byKey = new Map<string, DetectedGroceryItem>();
  for (const list of lists) {
    for (const item of list) {
      const key = item.name.toLowerCase().trim();
      if (!key) continue;
      const existing = byKey.get(key);
      if (
        !existing ||
        (item.confidence != null && existing.confidence != null && item.confidence > existing.confidence)
      ) {
        byKey.set(key, item);
      }
    }
  }
  return Array.from(byKey.values());
}

export default function IdentifyIngredientsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [ingredients, setIngredients] = useState<DetectedGroceryItem[] | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const primary =
    Colors[colorScheme ?? "light"].primary ?? Colors[colorScheme ?? "light"].tint;

  async function getBase64FromImagePicker(
    result: ImagePicker.ImagePickerResult
  ): Promise<string | null> {
    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    if ("base64" in asset && typeof asset.base64 === "string") {
      return asset.base64;
    }
    if ("uri" in asset && typeof asset.uri === "string") {
      try {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: "base64",
        });
        return base64;
      } catch {
        return null;
      }
    }
    return null;
  }

  /** Extract a single frame from video at timeMs (milliseconds). */
  async function getBase64FromVideoAtTime(
    uri: string,
    timeMs: number
  ): Promise<string | null> {
    try {
      const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(uri, {
        time: timeMs,
        quality: 0.8,
      });
      const base64 = await FileSystem.readAsStringAsync(thumbUri, {
        encoding: "base64",
      });
      return base64;
    } catch {
      return null;
    }
  }

  /** Extract multiple frames from video (0, 10s, 25s, 50s) and run AI on each, then merge ingredients. */
  async function runVisionFromVideo(videoUri: string) {
    setLoading(true);
    setIngredients(null);
    setImageUri(videoUri);
    const frameTimesMs = [0, 10_000, 25_000, 50_000];
    const frames: string[] = [];
    for (const timeMs of frameTimesMs) {
      const base64 = await getBase64FromVideoAtTime(videoUri, timeMs);
      if (base64) frames.push(base64);
    }
    if (frames.length === 0) {
      setLoading(false);
      Alert.alert(
        "Could not read video",
        "We couldn't extract frames from this video. Try another file."
      );
      return;
    }
    try {
      const allLists: DetectedGroceryItem[][] = [];
      for (const base64 of frames) {
        const list = await detectIngredientsFromImage(base64);
        allLists.push(list);
      }
      const merged = mergeDetectedIngredients(allLists);
      setIngredients(merged);
    } catch (e) {
      Alert.alert(
        "Could not identify ingredients",
        e instanceof Error ? e.message : "Check your Gemini API key and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function runVision(base64: string, previewUri?: string) {
    setLoading(true);
    setIngredients(null);
    setImageUri(previewUri ?? null);
    try {
      const list = await detectIngredientsFromImage(base64);
      setIngredients(list);
    } catch (e) {
      Alert.alert(
        "Could not identify ingredients",
        e instanceof Error ? e.message : "Check your Gemini API key and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera access needed", "Allow camera access to take a photo of ingredients.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      base64: true,
      quality: 0.8,
    });
    const base64 = await getBase64FromImagePicker(result);
    if (base64) await runVision(base64, result.assets?.[0]?.uri);
  }

  async function handleChoosePhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Gallery access needed", "Allow gallery access to choose a photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      base64: true,
      quality: 0.8,
    });
    const base64 = await getBase64FromImagePicker(result);
    if (base64) await runVision(base64, result.assets?.[0]?.uri);
  }

  async function handleChooseVideo() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Gallery access needed", "Allow gallery access to choose a video.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      videoMaxDuration: 300,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await runVisionFromVideo(result.assets[0].uri);
  }

  async function handleAddToGroceryList() {
    if (!user?.id || !ingredients?.length) return;
    const names = ingredients.map((i) => i.name);
    const { error } = await createOrUpdateGroceryList(user.id, names, null);
    if (error) {
      Alert.alert("Could not add to grocery list", error);
      return;
    }
    queryClient.invalidateQueries({ queryKey: groceryListQueryKey(user.id) });
    router.replace("/(tabs)/list");
  }

  async function handleAddToKitchen() {
    if (!user?.id || !ingredients?.length) return;
    for (const item of ingredients) {
      await addKitchenItem(user.id, item.name);
    }
    queryClient.invalidateQueries({ queryKey: kitchenInventoryQueryKey(user.id) });
    router.replace("/(tabs)/fridge");
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Identify ingredients with AI</Text>
      <Text style={styles.subtitle}>
        Take or choose a photo, or pick a video. We’ll use AI to list ingredients from the image or a frame.
      </Text>

      <View style={styles.buttonRow}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.pressed,
            { backgroundColor: primary },
          ]}
          onPress={handleTakePhoto}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Take photo</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.pressed,
            { borderColor: primary, borderWidth: 2, backgroundColor: "transparent" },
          ]}
          onPress={handleChoosePhoto}
          disabled={loading}
        >
          <Text style={[styles.buttonText, { color: primary }]}>Choose photo</Text>
        </Pressable>
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.buttonFull,
          pressed && styles.pressed,
          { borderColor: primary, borderWidth: 2, backgroundColor: "transparent" },
        ]}
        onPress={handleChooseVideo}
        disabled={loading}
      >
        <Text style={[styles.buttonText, { color: primary }]}>Choose video</Text>
      </Pressable>

      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={primary} />
          <Text style={styles.loadingText}>Identifying ingredients…</Text>
        </View>
      )}

      {!loading && ingredients && ingredients.length > 0 && (
        <View style={styles.result}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.preview} />
          ) : null}
          <Text style={styles.resultTitle}>Ingredients</Text>
          {ingredients.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.confidence != null && (
                <Text style={styles.confidence}>
                  {Math.round(item.confidence * 100)}%
                </Text>
              )}
            </View>
          ))}
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.pressed,
              { backgroundColor: primary },
            ]}
            onPress={handleAddToGroceryList}
          >
            <Text style={styles.actionButtonText}>Add to grocery list</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.actionButtonSecondary,
              pressed && styles.pressed,
              { borderColor: primary, borderWidth: 2 },
            ]}
            onPress={handleAddToKitchen}
          >
            <Text style={[styles.actionButtonText, { color: primary }]}>
              Add to My Kitchen
            </Text>
          </Pressable>
        </View>
      )}

      {!loading && ingredients && ingredients.length === 0 && (
        <Text style={styles.noResults}>No ingredients detected. Try another photo or video.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 15, opacity: 0.85, marginBottom: 24 },
  buttonRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonFull: { marginBottom: 24 },
  pressed: { opacity: 0.8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  loading: { alignItems: "center", paddingVertical: 32 },
  loadingText: { marginTop: 12, fontSize: 16, opacity: 0.8 },
  result: { marginTop: 24 },
  preview: { width: "100%", height: 200, borderRadius: 12, marginBottom: 16, backgroundColor: "#eee" },
  resultTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(128,128,128,0.3)" },
  itemName: { flex: 1, fontSize: 16 },
  confidence: { fontSize: 13, opacity: 0.7 },
  actionButton: { paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 16 },
  actionButtonSecondary: { backgroundColor: "transparent" },
  actionButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  noResults: { marginTop: 24, fontSize: 16, opacity: 0.8, textAlign: "center" },
});
