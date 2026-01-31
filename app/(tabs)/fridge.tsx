import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Trash2 } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import {
  useKitchenInventory,
  addKitchenItem,
  removeKitchenItem,
  itemsByCategory,
  kitchenInventoryQueryKey,
} from "@/hooks/useKitchenInventory";
import { GROCERY_CATEGORY_ORDER } from "@/lib/groceryCategories";
import type { KitchenInventoryItem } from "@/types";
import { Text, View } from "@/components/Themed";

export default function FridgeScreen() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { inventory, loading } = useKitchenInventory(user?.id);
  const [newItemName, setNewItemName] = useState("");
  const [adding, setAdding] = useState(false);
  const colorScheme = useColorScheme();
  const primary =
    Colors[colorScheme ?? "light"].primary ?? Colors[colorScheme ?? "light"].tint;

  const handleAdd = async () => {
    const name = newItemName.trim();
    if (!name || !user?.id) return;
    setAdding(true);
    const { error } = await addKitchenItem(user.id, name);
    setAdding(false);
    if (error) {
      Alert.alert("Could not add item", error);
      return;
    }
    setNewItemName("");
    queryClient.invalidateQueries({
      queryKey: kitchenInventoryQueryKey(user.id),
    });
  };

  const handleRemove = async (
    invId: string,
    items: KitchenInventoryItem[],
    itemId: string
  ) => {
    await removeKitchenItem(invId, items, itemId);
    queryClient.invalidateQueries({
      queryKey: kitchenInventoryQueryKey(user?.id),
    });
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text?.trim()) {
        const lines = text
          .split(/[\n,;]/)
          .map((s) => s.trim().replace(/^[\-\*\•]\s*/, ""))
          .filter(Boolean);
        if (lines.length > 0) {
          if (!user?.id) return;
          setAdding(true);
          for (const line of lines) {
            await addKitchenItem(user.id, line);
          }
          setAdding(false);
          queryClient.invalidateQueries({
            queryKey: kitchenInventoryQueryKey(user.id),
          });
        } else {
          Alert.alert("Clipboard empty", "Copy items (one per line or comma-separated), then paste.");
        }
      } else {
        Alert.alert("Clipboard empty", "Copy items from another app, then tap Paste.");
      }
    } catch {
      Alert.alert("Could not read clipboard", "Check app permissions.");
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.placeholder}>Loading…</Text>
      </View>
    );
  }

  const items = inventory?.items ?? [];
  const byCat = itemsByCategory(items);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="Add item (e.g. onion, flour)"
          placeholderTextColor="#999"
          value={newItemName}
          onChangeText={setNewItemName}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
          editable={!adding}
        />
        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: primary },
            (adding || !newItemName.trim()) && styles.addButtonDisabled,
            pressed && styles.addButtonPressed,
          ]}
          onPress={handleAdd}
          disabled={adding || !newItemName.trim()}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
      <Pressable
        style={({ pressed }) => [styles.pasteButton, pressed && styles.pasteButtonPressed]}
        onPress={handlePasteFromClipboard}
      >
        <Text style={styles.pasteButtonText}>Paste from clipboard</Text>
      </Pressable>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>My kitchen is empty</Text>
          <Text style={styles.emptySubtitle}>
            Add what you have in your fridge or pantry. We’ll use this to suggest recipes you can make.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {GROCERY_CATEGORY_ORDER.map((cat) => {
            const catItems = byCat[cat];
            if (!catItems?.length) return null;
            return (
              <View key={cat} style={styles.section}>
                <Text style={styles.sectionTitle}>{cat}</Text>
                {catItems.map((item) => (
                  <View key={item.id} style={styles.row}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Pressable
                      style={({ pressed }) => [
                        styles.removeButton,
                        pressed && styles.removeButtonPressed,
                      ]}
                      onPress={() => {
                        if (inventory)
                          handleRemove(inventory.id, inventory.items, item.id);
                      }}
                    >
                      <Trash2 size={20} color={primary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            );
          })}
          {byCat["Other"]?.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Other</Text>
              {byCat["Other"].map((item) => (
                <View key={item.id} style={styles.row}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.removeButton,
                      pressed && styles.removeButtonPressed,
                    ]}
                    onPress={() => {
                      if (inventory)
                        handleRemove(inventory.id, inventory.items, item.id);
                    }}
                  >
                    <Trash2 size={20} color={primary} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  placeholder: { padding: 24, textAlign: "center" },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.3)",
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(128,128,128,0.4)",
    borderRadius: 8,
  },
  addButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addButtonDisabled: { opacity: 0.5 },
  addButtonPressed: { opacity: 0.8 },
  addButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  pasteButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
    marginLeft: 16,
    marginTop: 4,
  },
  pasteButtonPressed: { opacity: 0.7 },
  pasteButtonText: { fontSize: 15, opacity: 0.9 },
  empty: { flex: 1, padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  emptySubtitle: { fontSize: 15, opacity: 0.8 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    opacity: 0.7,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(128,128,128,0.3)",
  },
  itemName: { flex: 1, fontSize: 17 },
  removeButton: { padding: 8 },
  removeButtonPressed: { opacity: 0.6 },
});
