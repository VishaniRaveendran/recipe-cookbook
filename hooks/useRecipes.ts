import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Recipe } from "@/types";

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

export function useRecipes(userId: string | undefined) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setRecipes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("recipes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setRecipes([]);
        } else {
          setRecipes((data ?? []).map(mapRow));
        }
        setLoading(false);
      });

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
          supabase
            .from("recipes")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .then(({ data }) => setRecipes((data ?? []).map(mapRow)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [userId]);

  return { recipes, loading };
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
): Promise<Recipe | null> {
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
  if (error) return null;
  return mapRow(data);
}

export async function markCooked(recipeId: string): Promise<boolean> {
  const { error } = await supabase
    .from("recipes")
    .update({ cooked_at: new Date().toISOString() } as Record<string, unknown>)
    .eq("id", recipeId);
  return !error;
}
