export interface Recipe {
  id: string;
  userId: string;
  sourceUrl: string;
  title: string;
  imageUrl?: string;
  ingredients: string[];
  steps: string[];
  createdAt: string;
  cookedAt?: string | null;
}

export interface GroceryItem {
  id: string;
  name: string;
  category: string;
  checked: boolean;
}

/** GroceryItem from Vision API with detection confidence (0–1). */
export interface DetectedGroceryItem extends GroceryItem {
  confidence: number;
}

export interface GroceryList {
  id: string;
  userId: string;
  recipeId?: string | null;
  items: GroceryItem[];
  createdAt: string;
}

export type GroceryCategory =
  | "Produce"
  | "Dairy"
  | "Meat"
  | "Pantry"
  | "Bakery"
  | "Frozen"
  | "Other";

/** Grocery list grouped by supermarket aisle (from parse API). */
export interface GroceryByAisle {
  aisle: string;
  items: string[];
}

export interface ParsedRecipe {
  title: string;
  imageUrl?: string;
  ingredients: string[];
  steps: string[];
  servings?: number;
  /** When present, ingredients grouped by supermarket aisle (Produce, Dairy, etc.). */
  groceryByAisle?: GroceryByAisle[];
}

/** Single item in kitchen inventory (fridge/pantry). */
export interface KitchenInventoryItem {
  id: string;
  name: string;
}

export interface KitchenInventory {
  id: string;
  userId: string;
  items: KitchenInventoryItem[];
  updatedAt: string;
}
