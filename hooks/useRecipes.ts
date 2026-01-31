import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Recipe } from "@/types";

export const recipesQueryKey = (userId: string | undefined) =>
  userId ? ["recipes", userId] : ["recipes", null];

function mapRow(r: {
  id: string;
  user_id: string;
  source_url: string;
  title: string;
  image_url: string | null;
  ingredients: string[];
  steps: string[];
  created_at: string;
  cooked_at: string | null;
}): Recipe {
  return {
    id: r.id,
    userId: r.user_id,
    sourceUrl: r.source_url,
    title: r.title,
    imageUrl: r.image_url ?? undefined,
    ingredients: r.ingredients ?? [],
    steps: r.steps ?? [],
    createdAt: r.created_at,
    cookedAt: r.cooked_at,
  };
}

async function fetchRecipes(userId: string): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map(mapRow);
}

export function useRecipes(userId: string | undefined) {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: recipesQueryKey(userId),
    queryFn: () => fetchRecipes(userId!),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;
    const sub = supabase
      .channel("recipes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "recipes",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: recipesQueryKey(userId) });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [userId, queryClient]);

  return {
    recipes: data ?? [],
    loading: isLoading,
    refetch,
  };
}

export async function insertRecipe(
  userId: string,
  recipe: {
    sourceUrl: string;
    title: string;
    imageUrl?: string;
    ingredients: string[];
    steps: string[];
  }
): Promise<{ recipe: Recipe | null; error: string | null }> {
  const { data, error } = await supabase
    .from("recipes")
    .insert({
      user_id: userId,
      source_url: recipe.sourceUrl,
      title: recipe.title,
      image_url: recipe.imageUrl ?? null,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
    } as Record<string, unknown>)
    .select()
    .single();
  if (error) return { recipe: null, error: error.message };
  return { recipe: mapRow(data), error: null };
}

export async function markCooked(recipeId: string): Promise<boolean> {
  const { error } = await supabase
    .from("recipes")
    .update({ cooked_at: new Date().toISOString() } as Record<string, unknown>)
    .eq("id", recipeId);
  return !error;
}
