import type { GroceryCategory } from "@/types";

const CATEGORY_KEYWORDS: Record<GroceryCategory, string[]> = {
  Produce: [
    "onion",
    "garlic",
    "tomato",
    "lettuce",
    "carrot",
    "celery",
    "potato",
    "lemon",
    "lime",
    "apple",
    "banana",
    "avocado",
    "pepper",
    "broccoli",
    "spinach",
    "kale",
    "herb",
    "basil",
    "parsley",
    "cilantro",
    "ginger",
    "cucumber",
    "zucchini",
    "mushroom",
    "corn",
    "pea",
    "bean",
    "fruit",
    "vegetable",
    "scallion",
    "shallot",
  ],
  Dairy: ["milk", "cream", "butter", "cheese", "yogurt", "egg"],
  Meat: [
    "chicken",
    "beef",
    "pork",
    "bacon",
    "sausage",
    "turkey",
    "lamb",
    "fish",
    "salmon",
    "shrimp",
    "meat",
  ],
  Pantry: [
    "oil",
    "vinegar",
    "salt",
    "sugar",
    "flour",
    "rice",
    "pasta",
    "noodle",
    "sauce",
    "soy",
    "broth",
    "stock",
    "canned",
    "beans",
    "lentil",
    "spice",
    "pepper",
    "paprika",
    "cumin",
    "oregano",
    "nut",
    "honey",
    "maple",
    "mustard",
    "ketchup",
    "breadcrumb",
    "baking",
    "vanilla",
    "chocolate",
    "coconut",
    "almond",
    "peanut",
  ],
  Bakery: ["bread", "tortilla", "wrap", "pita"],
  Frozen: ["frozen", "ice"],
  Other: [],
};

export function getCategoryForIngredient(ingredient: string): GroceryCategory {
  const lower = ingredient.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === "Other") continue;
    if (keywords.some((kw) => lower.includes(kw))) {
      return category as GroceryCategory;
    }
  }
  return "Other";
}

export const GROCERY_CATEGORY_ORDER: GroceryCategory[] = [
  "Produce",
  "Dairy",
  "Pantry",
  "Meat",
  "Bakery",
  "Frozen",
  "Other",
];
