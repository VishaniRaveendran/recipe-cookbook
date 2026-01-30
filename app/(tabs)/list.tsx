import { StyleSheet, Pressable, ScrollView } from "react-native";
import { useAuth } from "@/context/AuthContext";
import {
  useGroceryList,
  itemsByCategory,
  toggleGroceryItem,
} from "@/hooks/useGroceryList";
import { GROCERY_CATEGORY_ORDER } from "@/lib/groceryCategories";
import { Text, View } from "@/components/Themed";

export default function GroceryListScreen() {
  const { user } = useAuth();
  const { list, loading } = useGroceryList(user?.id);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.placeholder}>Loading list…</Text>
      </View>
    );
  }

  if (!list || list.items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No grocery list yet</Text>
          <Text style={styles.emptySubtitle}>
            Add a recipe and tap "Add to Grocery List" to build your list.
          </Text>
        </View>
      </View>
    );
  }

  const byCat = itemsByCategory(list.items);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {GROCERY_CATEGORY_ORDER.map((cat) => {
        const items = byCat[cat];
        if (!items?.length) return null;
        return (
          <View key={cat} style={styles.section}>
            <Text style={styles.sectionTitle}>{cat}</Text>
            {items.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => toggleGroceryItem(list.id, list.items, item.id)}
              >
                <View
                  style={[
                    styles.checkbox,
                    item.checked && styles.checkboxChecked,
                  ]}
                >
                  {item.checked && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text
                  style={[styles.itemName, item.checked && styles.itemChecked]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </Pressable>
            ))}
          </View>
        );
      })}
      {byCat["Other"]?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Other</Text>
          {byCat["Other"].map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed,
              ]}
              onPress={() => toggleGroceryItem(list.id, list.items, item.id)}
            >
              <View
                style={[
                  styles.checkbox,
                  item.checked && styles.checkboxChecked,
                ]}
              >
                {item.checked && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text
                style={[styles.itemName, item.checked && styles.itemChecked]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  placeholder: { padding: 24, textAlign: "center" },
  empty: { flex: 1, padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  emptySubtitle: { fontSize: 15, opacity: 0.8 },
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
  rowPressed: { opacity: 0.7 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#2f95dc",
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#2f95dc",
  },
  checkmark: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  itemName: { flex: 1, fontSize: 17 },
  itemChecked: { textDecorationLine: "line-through", opacity: 0.6 },
});
