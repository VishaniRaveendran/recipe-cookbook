import type { VercelRequest, VercelResponse } from "@vercel/node";

interface ParsedRecipe {
  title: string;
  imageUrl?: string;
  ingredients: string[];
  steps: string[];
}

function extractFromHtml(html: string): ParsedRecipe {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch
    ? titleMatch[1].trim().replace(/&[^;]+;/g, " ")
    : "Untitled Recipe";

  const ogImageMatch =
    html.match(
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
    ) ??
    html.match(
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i
    );
  const imageUrl = ogImageMatch ? ogImageMatch[1] : undefined;

  const jsonLdMatch = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (jsonLdMatch) {
    try {
      const json = JSON.parse(jsonLdMatch[1].trim());
      const recipe = Array.isArray(json)
        ? json.find((x: { "@type"?: string }) => x["@type"] === "Recipe")
        : json["@type"] === "Recipe"
        ? json
        : null;
      if (recipe) {
        const ingredients = Array.isArray(recipe.recipeIngredient)
          ? recipe.recipeIngredient
          : typeof recipe.recipeIngredient === "string"
          ? [recipe.recipeIngredient]
          : [];
        const steps = Array.isArray(recipe.recipeInstructions)
          ? recipe.recipeInstructions.map((s: { text?: string } | string) =>
              typeof s === "string" ? s : s.text ?? ""
            )
          : [];
        return {
          title: recipe.name ?? title,
          imageUrl: recipe.image?.[0] ?? recipe.image ?? imageUrl,
          ingredients,
          steps: steps.filter(Boolean),
        };
      }
    } catch {
      // fall through
    }
  }

  const listMatch = html.match(/<ul[^>]*>([\s\S]*?)<\/ul>/gi);
  const ingredients: string[] = [];
  if (listMatch) {
    for (const list of listMatch) {
      const items = list.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
      if (items && items.length >= 2 && items.length <= 50) {
        for (const item of items) {
          const text = item
            .replace(/<[^>]+>/g, "")
            .replace(/&[^;]+;/g, " ")
            .trim();
          if (text.length > 2 && text.length < 200) ingredients.push(text);
        }
        if (ingredients.length > 0) break;
      }
    }
  }

  return { title, imageUrl, ingredients, steps: [] };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const url = typeof req.query.url === "string" ? req.query.url : null;
  if (!url || !url.startsWith("http")) {
    return res.status(400).json({ error: "Missing or invalid url" });
  }
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "RecipeParser/1.0" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const recipe = extractFromHtml(html);
    return res.status(200).json(recipe);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
