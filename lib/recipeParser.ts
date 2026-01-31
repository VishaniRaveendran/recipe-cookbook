import type { ParsedRecipe } from "@/types";

const PARSER_API_URL = process.env.EXPO_PUBLIC_PARSER_API_URL ?? "";

/** Build a friendly title for links we can't parse (YouTube, Instagram, etc.). */
function getTitleFromUrl(url: string): string {
  try {
    const lower = url.toLowerCase();
    if (lower.includes("youtube.com") || lower.includes("youtu.be"))
      return "Recipe from YouTube";
    if (lower.includes("instagram.com")) return "Recipe from Instagram";
    if (lower.includes("tiktok.com")) return "Recipe from TikTok";
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    return `Recipe from ${host}`;
  } catch {
    return "Recipe from link";
  }
}

export async function parseRecipeFromUrl(
  url: string
): Promise<ParsedRecipe | null> {
  if (!url.trim()) return null;
  const trimmed = url.trim();
  const isUrl = trimmed.startsWith("http://") || trimmed.startsWith("https://");

  if (!isUrl) {
    return parseWithHeuristics(trimmed);
  }

  if (PARSER_API_URL) {
    try {
      const res = await fetch(
        `${PARSER_API_URL}/api/parse?url=${encodeURIComponent(trimmed)}`
      );
      if (res.ok) {
        const data = await res.json();
        const title =
          data?.title && typeof data.title === "string"
            ? data.title.trim()
            : getTitleFromUrl(trimmed);
        const ingredients = Array.isArray(data?.ingredients)
          ? data.ingredients
          : [];
        const steps = Array.isArray(data?.steps) ? data.steps : [];
        const servings =
          typeof data?.servings === "number" && data.servings > 0
            ? data.servings
            : undefined;
        const groceryByAisle = Array.isArray(data?.groceryByAisle)
          ? data.groceryByAisle
              .filter(
                (g: unknown) =>
                  g != null &&
                  typeof g === "object" &&
                  typeof (g as { aisle?: unknown }).aisle === "string" &&
                  Array.isArray((g as { items?: unknown }).items)
              )
              .map((g: { aisle: string; items: unknown[] }): { aisle: string; items: string[] } => ({
                aisle: g.aisle,
                items: g.items.filter((i): i is string => typeof i === "string"),
              }))
              .filter((g: { aisle: string; items: string[] }) => g.items.length > 0)
          : undefined;
        return {
          title: title || getTitleFromUrl(trimmed),
          imageUrl:
            typeof data?.imageUrl === "string" ? data.imageUrl : undefined,
          ingredients,
          steps,
          ...(servings != null && { servings }),
          ...(groceryByAisle?.length ? { groceryByAisle } : {}),
        };
      }
    } catch {
      // use manual-entry result below
    }
  }

  // URL but no API or API failed: show manual entry with a friendly title
  return {
    title: getTitleFromUrl(trimmed),
    ingredients: [],
    steps: [],
    servings: 4,
  };
}

function parseWithHeuristics(input: string): ParsedRecipe | null {
  const lines = input
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const title = lines[0];
  const ingredients: string[] = [];
  const steps: string[] = [];
  let inIngredients = false;
  let inSteps = false;

  const ingredientPattern = /^[\-\*\•]\s*(.+)$|^(\d+[\.\)]\s*.+)$|^(.+)$/;
  const ingredientKeywords = [
    "cup",
    "tbsp",
    "tsp",
    "oz",
    "lb",
    "clove",
    "can",
    "pinch",
    "slice",
    "chopped",
    "diced",
    "minced",
  ];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    if (lower.includes("ingredient")) {
      inIngredients = true;
      inSteps = false;
      continue;
    }
    if (
      lower.includes("instruction") ||
      lower.includes("direction") ||
      lower.includes("step")
    ) {
      inSteps = true;
      inIngredients = false;
      continue;
    }
    const looksLikeIngredient =
      ingredientKeywords.some((k) => lower.includes(k)) ||
      /^\d+\s*(cup|tbsp|tsp|oz|lb)/.test(lower) ||
      /^[\-\*\•]/.test(line);
    if (inIngredients && (looksLikeIngredient || line.length < 80)) {
      const match = line.replace(/^[\-\*\•]\s*/, "").trim();
      if (match && match.length > 1) ingredients.push(match);
    } else if (inSteps && line.length > 10) {
      steps.push(line);
    } else if (!inIngredients && !inSteps && looksLikeIngredient) {
      ingredients.push(line.replace(/^[\-\*\•]\s*/, "").trim());
    }
  }

  return {
    title: title || "Untitled Recipe",
    ingredients: ingredients.length > 0 ? ingredients : [],
    steps: steps.length > 0 ? steps : [],
    servings: 4,
  };
}

export function parseManualIngredients(text: string): string[] {
  return text
    .split(/[\n,;]/)
    .map((s) => s.trim().replace(/^[\-\*\•]\s*/, ""))
    .filter(Boolean);
}
