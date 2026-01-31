import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  getCategoryForIngredient,
  GROCERY_CATEGORY_ORDER,
} from "@/lib/groceryCategories";
import type {
  KitchenInventory,
  KitchenInventoryItem,
  GroceryCategory,
} from "@/types";

export const kitchenInventoryQueryKey = (userId: string | undefined) =>
  userId ? ["kitchen_inventory", userId] : ["kitchen_inventory", null];

function mapRow(r: {
  id: string;
  user_id: string;
  items: unknown;
  updated_at: string;
}): KitchenInventory {
  const items = (r.items as KitchenInventoryItem[]) ?? [];
  return {
    id: r.id,
    userId: r.user_id,
    items,
    updatedAt: r.updated_at,
  };
}

async function fetchKitchenInventory(
  userId: string
): Promise<KitchenInventory | null> {
  const { data, error } = await supabase
    .from("kitchen_inventory")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data);
}

export function useKitchenInventory(userId: string | undefined) {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: kitchenInventoryQueryKey(userId),
    queryFn: () => fetchKitchenInventory(userId!),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;
    const sub = supabase
      .channel("kitchen_inventory")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "kitchen_inventory",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: kitchenInventoryQueryKey(userId),
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [userId, queryClient]);

  return {
    inventory: data ?? null,
    loading: isLoading,
    refetch,
  };
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function addKitchenItem(
  userId: string,
  name: string
): Promise<{ inventory: KitchenInventory | null; error: string | null }> {
  const trimmed = name.trim();
  if (!trimmed) return { inventory: null, error: "Name is required" };

  const newItem: KitchenInventoryItem = {
    id: generateId(),
    name: trimmed,
  };

  const { data: existing, error: fetchError } = await supabase
    .from("kitchen_inventory")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) return { inventory: null, error: fetchError.message };

  if (existing) {
    const currentItems =
      (existing as { items: KitchenInventoryItem[] }).items ?? [];
    const found = currentItems.some(
      (i) => i.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (found)
      return {
        inventory: mapRow(existing as Parameters<typeof mapRow>[0]),
        error: null,
      };
    const merged = [...currentItems, newItem];
    const { data, error } = await supabase
      .from("kitchen_inventory")
      .update({
        items: merged,
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq("id", (existing as { id: string }).id)
      .select()
      .single();
    if (error) return { inventory: null, error: error.message };
    return { inventory: mapRow(data as Parameters<typeof mapRow>[0]), error: null };
  }

  const { data, error } = await supabase
    .from("kitchen_inventory")
    .insert({
      user_id: userId,
      items: [newItem],
    } as Record<string, unknown>)
    .select()
    .single();
  if (error) return { inventory: null, error: error.message };
  return { inventory: mapRow(data as Parameters<typeof mapRow>[0]), error: null };
}

export async function removeKitchenItem(
  inventoryId: string,
  items: KitchenInventoryItem[],
  itemId: string
): Promise<boolean> {
  const updated = items.filter((i) => i.id !== itemId);
  const { error } = await supabase
    .from("kitchen_inventory")
    .update({
      items: updated,
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq("id", inventoryId);
  return !error;
}

export function itemsByCategory(
  items: KitchenInventoryItem[]
): Record<string, KitchenInventoryItem[]> {
  const byCat: Record<string, KitchenInventoryItem[]> = {};
  for (const cat of GROCERY_CATEGORY_ORDER) {
    byCat[cat] = items.filter(
      (i) => getCategoryForIngredient(i.name) === (cat as GroceryCategory)
    );
  }
  const other = items.filter(
    (i) => !GROCERY_CATEGORY_ORDER.includes(getCategoryForIngredient(i.name) as never)
  );
  if (other.length) byCat["Other"] = other;
  return byCat;
}
