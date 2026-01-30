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

export interface ParsedRecipe {
  title: string;
  imageUrl?: string;
  ingredients: string[];
  steps: string[];
}
