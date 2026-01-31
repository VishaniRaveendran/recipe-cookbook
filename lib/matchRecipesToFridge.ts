import type { Recipe, KitchenInventoryItem } from "@/types";

/** Normalize ingredient text for matching: lowercase, strip amounts/units, trim. */
function normalizeIngredient(text: string): string {
  const lower = text
    .toLowerCase()
    .trim()
    // Strip leading numbers and fractions (e.g. "2", "1/2", "1 1/2")
    .replace(/^\d+\s*\/\s*\d+\s*/, "")
    .replace(/^\d+\.?\d*\s*/, "")
    // Strip common units and trailing parentheticals
    .replace(
      /\s*(cup|cups|tbsp|tsp|oz|lb|g|ml|clove|cloves|can|cans|pinch|slice|slices|piece|pieces|stalk|stalks)\s*(?:of\s+)?/gi,
      " "
    )
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return lower;
}

/** Simple synonym map for common ingredients (key = normalized alias, value = canonical form). */
const INGREDIENT_SYNONYMS: Record<string, string> = {
  "green onion": "scallion",
  "green onions": "scallion",
  scallion: "scallion",
  scallions: "scallion",
  "spring onion": "scallion",
  "spring onions": "scallion",
  cilantro: "coriander",
  "coriander leaves": "coriander",
  coriander: "coriander",
  "bell pepper": "pepper",
  "bell peppers": "pepper",
  "chili pepper": "pepper",
  "chilli pepper": "pepper",
  "fresh basil": "basil",
  basil: "basil",
  "tomato paste": "tomato",
  "tomato sauce": "tomato",
  tomatoes: "tomato",
  tomato: "tomato",
  "olive oil": "oil",
  "vegetable oil": "oil",
  "cooking oil": "oil",
  oil: "oil",
  "all-purpose flour": "flour",
  "plain flour": "flour",
  flour: "flour",
  "minced garlic": "garlic",
  "garlic clove": "garlic",
  "garlic cloves": "garlic",
  garlic: "garlic",
  "yellow onion": "onion",
  "red onion": "onion",
  "white onion": "onion",
  onions: "onion",
  onion: "onion",
  "soy sauce": "soy",
  "soy sauce (optional)": "soy",
  soy: "soy",
  eggs: "egg",
  egg: "egg",
  butter: "butter",
  "unsalted butter": "butter",
  "salted butter": "butter",
  milk: "milk",
  "whole milk": "milk",
  cheese: "cheese",
  salt: "salt",
  "table salt": "salt",
  "black pepper": "pepper",
  "ground pepper": "pepper",
  pepper: "pepper",
  sugar: "sugar",
  "brown sugar": "sugar",
  "white sugar": "sugar",
  "granulated sugar": "sugar",
};

function toCanonical(normalized: string): string {
  return INGREDIENT_SYNONYMS[normalized] ?? normalized;
}

/** Check if a single recipe ingredient is "covered" by any fridge item (substring or token overlap). */
function ingredientMatchesFridge(
  recipeIngredient: string,
  fridgeNormalizedSet: Set<string>,
  fridgeTokenSets: Map<string, Set<string>>
): boolean {
  const norm = normalizeIngredient(recipeIngredient);
  const canonical = toCanonical(norm);
  if (fridgeNormalizedSet.has(norm) || fridgeNormalizedSet.has(canonical))
    return true;
  // Substring: any fridge item name contained in recipe ingredient or vice versa
  for (const fridgeNorm of fridgeNormalizedSet) {
    if (norm.includes(fridgeNorm) || fridgeNorm.includes(norm)) return true;
    const canFridge = toCanonical(fridgeNorm);
    if (norm.includes(canFridge) || canFridge.includes(norm)) return true;
  }
  // Token overlap: at least one significant word in common
  const recipeTokens = new Set(
    norm.split(/\s+/).filter((t) => t.length > 1 && !/^\d+$/.test(t))
  );
  for (const [fridgeNorm, tokens] of fridgeTokenSets) {
    if (norm.includes(fridgeNorm) || fridgeNorm.includes(norm)) return true;
    for (const t of recipeTokens) {
      if (tokens.has(t) && t.length > 2) return true;
    }
  }
  return false;
}

export type MatchLevel = "can_make" | "almost" | "need_more";

export interface RecipeMatch {
  recipe: Recipe;
  level: MatchLevel;
  matchedCount: number;
  totalIngredients: number;
  missingIngredients: string[];
  score: number; // 0–1
}

const ALMOST_THRESHOLD = 0.8; // 80% ingredients matched = "almost"

/**
 * Build normalized set and token sets from fridge items for fast lookup.
 */
function buildFridgeLookup(items: KitchenInventoryItem[]): {
  normalizedSet: Set<string>;
  tokenSets: Map<string, Set<string>>;
} {
  const normalizedSet = new Set<string>();
  const tokenSets = new Map<string, Set<string>>();
  for (const item of items) {
    const norm = normalizeIngredient(item.name);
    if (!norm) continue;
    normalizedSet.add(norm);
    normalizedSet.add(toCanonical(norm));
    const tokens = new Set(
      norm.split(/\s+/).filter((t) => t.length > 1 && !/^\d+$/.test(t))
    );
    tokenSets.set(norm, tokens);
  }
  return { normalizedSet, tokenSets };
}

/**
 * Match recipes against fridge/pantry items. Returns recipes grouped by match level
 * with missing ingredients for "almost" and "need_more".
 */
export function matchRecipesToFridge(
  recipes: Recipe[],
  fridgeItems: KitchenInventoryItem[]
): RecipeMatch[] {
  const { normalizedSet, tokenSets } = buildFridgeLookup(fridgeItems);
  const results: RecipeMatch[] = [];

  for (const recipe of recipes) {
    const ingredients = recipe.ingredients ?? [];
    if (ingredients.length === 0) {
      results.push({
        recipe,
        level: "need_more",
        matchedCount: 0,
        totalIngredients: 0,
        missingIngredients: [],
        score: 0,
      });
      continue;
    }

    const missing: string[] = [];
    let matched = 0;
    for (const ing of ingredients) {
      const covered = ingredientMatchesFridge(ing, normalizedSet, tokenSets);
      if (covered) matched++;
      else missing.push(ing.trim());
    }

    const score = matched / ingredients.length;
    let level: MatchLevel = "need_more";
    if (score >= 1) level = "can_make";
    else if (score >= ALMOST_THRESHOLD) level = "almost";

    results.push({
      recipe,
      level,
      matchedCount: matched,
      totalIngredients: ingredients.length,
      missingIngredients: missing,
      score,
    });
  }

  return results;
}

/**
 * Sort matches: can_make first, then almost (by score desc), then need_more (by score desc).
 */
export function sortRecipeMatches(matches: RecipeMatch[]): RecipeMatch[] {
  return [...matches].sort((a, b) => {
    const order = { can_make: 0, almost: 1, need_more: 2 };
    if (order[a.level] !== order[b.level])
      return order[a.level] - order[b.level];
    return b.score - a.score;
  });
}
