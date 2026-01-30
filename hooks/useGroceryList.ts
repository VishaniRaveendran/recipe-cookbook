import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getCategoryForIngredient,
  GROCERY_CATEGORY_ORDER,
} from "@/lib/groceryCategories";
import type { GroceryList, GroceryItem } from "@/types";

function mapRow(r: {
  id: string;
  user_id: string;
  recipe_id: string | null;
  items: unknown;
  created_at: string;
}): GroceryList {
  const items = (r.items as GroceryItem[]) ?? [];
  return {
    id: r.id,
    userId: r.user_id,
    recipeId: r.recipe_id,
    items,
    createdAt: r.created_at,
  };
}

export function useGroceryList(userId: string | undefined) {
  const [list, setList] = useState<GroceryList | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setList(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("grocery_lists")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (error || !data?.length) {
          setList(null);
        } else {
          setList(mapRow(data[0]));
        }
        setLoading(false);
      });

    const sub = supabase
      .channel("grocery")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "grocery_lists",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          supabase
            .from("grocery_lists")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .then(({ data }) => {
              if (data?.length) setList(mapRow(data[0]));
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [userId]);

  return { list, loading };
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function ingredientToItem(name: string): GroceryItem {
  return {
    id: generateId(),
    name: name.trim(),
    category: getCategoryForIngredient(name),
    checked: false,
  };
}

export function itemsByCategory(
  items: GroceryItem[]
): Record<string, GroceryItem[]> {
  const byCat: Record<string, GroceryItem[]> = {};
  for (const cat of GROCERY_CATEGORY_ORDER) {
    byCat[cat] = items.filter((i) => i.category === cat);
  }
  const other = items.filter(
    (i) => !GROCERY_CATEGORY_ORDER.includes(i.category as never)
  );
  if (other.length) byCat["Other"] = other;
  return byCat;
}

export async function createOrUpdateGroceryList(
  userId: string,
  ingredients: string[],
  recipeId?: string | null
): Promise<{ list: GroceryList | null; error: string | null }> {
  const newItems = ingredients.map(ingredientToItem);
  const { data: existing, error: fetchError } = await supabase
    .from("grocery_lists")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) return { list: null, error: fetchError.message };

  if (existing) {
    const currentItems = (existing as { items: GroceryItem[] }).items ?? [];
    const merged = [...currentItems];
    for (const item of newItems) {
      const found = merged.find(
        (m) => m.name.toLowerCase() === item.name.toLowerCase()
      );
      if (!found) merged.push(item);
    }
    const { data, error } = await supabase
      .from("grocery_lists")
      .update({
        items: merged,
        recipe_id:
          recipeId ?? (existing as { recipe_id: string | null }).recipe_id,
      } as Record<string, unknown>)
      .eq("id", (existing as { id: string }).id)
      .select()
      .single();
    if (error) return { list: null, error: error.message };
    return { list: mapRow(data as Parameters<typeof mapRow>[0]), error: null };
  }

  const { data, error } = await supabase
    .from("grocery_lists")
    .insert({
      user_id: userId,
      recipe_id: recipeId ?? null,
      items: newItems,
    } as Record<string, unknown>)
    .select()
    .single();
  if (error) return { list: null, error: error.message };
  return { list: mapRow(data as Parameters<typeof mapRow>[0]), error: null };
}

export async function toggleGroceryItem(
  listId: string,
  items: GroceryItem[],
  itemId: string
): Promise<boolean> {
  const updated = items.map((i) =>
    i.id === itemId ? { ...i, checked: !i.checked } : i
  );
  const { error } = await supabase
    .from("grocery_lists")
    .update({ items: updated } as Record<string, unknown>)
    .eq("id", listId);
  return !error;
}
