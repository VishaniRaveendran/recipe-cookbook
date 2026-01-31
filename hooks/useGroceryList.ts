import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  getCategoryForIngredient,
  GROCERY_CATEGORY_ORDER,
} from "@/lib/groceryCategories";
import type { GroceryList, GroceryItem } from "@/types";

export const groceryListQueryKey = (userId: string | undefined) =>
  userId ? ["grocery", userId] : ["grocery", null];

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

async function fetchGroceryList(userId: string): Promise<GroceryList | null> {
  const { data, error } = await supabase
    .from("grocery_lists")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data);
}

export function useGroceryList(userId: string | undefined) {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: groceryListQueryKey(userId),
    queryFn: () => fetchGroceryList(userId!),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;
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
          queryClient.invalidateQueries({
            queryKey: groceryListQueryKey(userId),
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [userId, queryClient]);

  return {
    list: data ?? null,
    loading: isLoading,
    refetch,
  };
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function ingredientToItem(
  name: string,
  categoryOverride?: Record<string, string>
): GroceryItem {
  const key = name.trim().toLowerCase();
  const category =
    categoryOverride?.[key] ?? getCategoryForIngredient(name);
  return {
    id: generateId(),
    name: name.trim(),
    category,
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

/** Optional: map ingredient name (lowercase) to aisle/category from parse API. */
export type CategoryByIngredient = Record<string, string>;

export async function createOrUpdateGroceryList(
  userId: string,
  ingredients: string[],
  recipeId?: string | null,
  categoryByIngredient?: CategoryByIngredient
): Promise<{ list: GroceryList | null; error: string | null }> {
  const newItems = ingredients.map((name) =>
    ingredientToItem(name, categoryByIngredient)
  );
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
