import type { VercelRequest, VercelResponse } from "@vercel/node";

interface ParsedRecipe {
  title: string;
  imageUrl?: string;
  ingredients: string[];
  steps: string[];
}

/** Extract YouTube video ID from watch or short URL. */
function getYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "www.youtube.com" || u.hostname === "youtube.com") {
      return u.searchParams.get("v");
    }
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0];
    return null;
  } catch {
    return null;
  }
}

/** Parse recipe from video description text (Ingredients / Instructions sections). */
function parseDescriptionToRecipe(
  description: string,
  title: string,
  imageUrl?: string
): ParsedRecipe {
  const lines = description
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const ingredients: string[] = [];
  const steps: string[] = [];
  let section: "ingredients" | "steps" | null = null;
  const ingredientKeywords = [
    "cup",
    "tbsp",
    "tsp",
    "oz",
    "lb",
    "clove",
    "can",
    "pinch",
    "chopped",
    "diced",
    "minced",
    "slice",
    "g",
    "ml",
    "salt",
    "pepper",
    "oil",
    "water",
    "flour",
    "sugar",
    "egg",
    "butter",
    "garlic",
    "onion",
  ];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/^(ingredients?|what you need):?\s*$/i.test(lower)) {
      section = "ingredients";
      continue;
    }
    if (
      /^(instructions?|directions?|steps?|method):?\s*$/i.test(lower) ||
      /^(how to make|recipe):?\s*$/i.test(lower)
    ) {
      section = "steps";
      continue;
    }
    const isBullet =
      /^[\-\*\•]\s+/.test(line) ||
      /^\d+[\.\)]\s+/.test(line) ||
      /^\d+\.\s+/.test(line);
    const text = line
      .replace(/^[\-\*\•]\s*/, "")
      .replace(/^\d+[\.\)]\s*/, "")
      .trim();
    if (!text || text.length > 300) continue;

    if (section === "ingredients") {
      if (
        ingredientKeywords.some((k) => lower.includes(k)) ||
        /^\d+[\s\/]*(cup|tbsp|tsp|oz|lb|g|ml)/.test(lower) ||
        isBullet
      ) {
        ingredients.push(text);
      }
    } else if (section === "steps") {
      if (isBullet || /^\d+\./.test(line) || text.length > 20) {
        steps.push(text);
      }
    } else {
      if (
        ingredientKeywords.some((k) => lower.includes(k)) &&
        text.length < 150
      ) {
        ingredients.push(text);
      }
    }
  }

  return {
    title,
    imageUrl,
    ingredients: ingredients.slice(0, 80),
    steps: steps.slice(0, 30).filter((s) => s.length > 5),
  };
}

/** Fetch video captions/transcript (no API key). Returns combined text or null. */
async function fetchTranscriptText(videoId: string): Promise<string | null> {
  try {
    const { YoutubeTranscript } = await import("youtube-transcript");
    const chunks = await YoutubeTranscript.fetchTranscript(videoId);
    if (!Array.isArray(chunks) || chunks.length === 0) return null;
    const text = chunks
      .map((c: { text?: string }) =>
        c && typeof c.text === "string" ? c.text : ""
      )
      .filter(Boolean)
      .join(" ");
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

/** Extract ingredient-like phrases from spoken transcript (e.g. "we need 2 cups flour"). */
function parseTranscriptForIngredients(transcript: string): string[] {
  const ingredients: string[] = [];
  const seen = new Set<string>();
  const lower = transcript.toLowerCase();
  const keywords = [
    "cup",
    "cups",
    "tbsp",
    "tsp",
    "oz",
    "lb",
    "clove",
    "can",
    "pinch",
    "chopped",
    "diced",
    "minced",
    "salt",
    "pepper",
    "flour",
    "sugar",
    "egg",
    "eggs",
    "butter",
    "garlic",
    "onion",
    "oil",
    "water",
    "ml",
    "g",
  ];
  const quantityPattern =
    /\d+\s*(?:\.\d+)?\s*(?:cup|tbsp|tsp|oz|lb|g|ml)s?\s+(?:of\s+)?[\w\s]+/gi;
  let m: RegExpExecArray | null;
  while ((m = quantityPattern.exec(transcript)) !== null) {
    const phrase = m[0].trim();
    if (phrase.length > 3 && phrase.length < 120) {
      const key = phrase.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        ingredients.push(phrase);
      }
    }
  }
  const sentences = transcript.split(/[.!?]\s+/);
  for (const sent of sentences) {
    const s = sent.trim();
    if (s.length < 10 || s.length > 200) continue;
    const sl = s.toLowerCase();
    if (keywords.some((k) => sl.includes(k))) {
      const key = s.toLowerCase().slice(0, 80);
      if (!seen.has(key)) {
        seen.add(key);
        ingredients.push(s);
      }
    }
  }
  return ingredients.slice(0, 50);
}

async function fetchYouTubeRecipe(
  videoId: string,
  apiKey: string
): Promise<ParsedRecipe | null> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const item = data?.items?.[0];
  if (!item?.snippet) return null;
  const { title, description, thumbnails } = item.snippet;
  const imageUrl =
    thumbnails?.maxres?.url ?? thumbnails?.high?.url ?? thumbnails?.medium?.url;
  const fromDescription = parseDescriptionToRecipe(
    description || "",
    title || "YouTube recipe",
    imageUrl
  );
  const transcriptText = await fetchTranscriptText(videoId);
  if (transcriptText && fromDescription.ingredients.length < 5) {
    const fromTranscript = parseTranscriptForIngredients(transcriptText);
    const merged = [...fromDescription.ingredients];
    const seen = new Set(merged.map((i) => i.toLowerCase().slice(0, 50)));
    for (const ing of fromTranscript) {
      const key = ing.toLowerCase().slice(0, 50);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(ing);
      }
    }
    return {
      ...fromDescription,
      ingredients: merged.slice(0, 80),
    };
  }
  return fromDescription;
}

/** YouTube recipe using only transcript (no YOUTUBE_API_KEY). */
async function fetchYouTubeRecipeFromTranscript(
  videoId: string
): Promise<ParsedRecipe | null> {
  const transcriptText = await fetchTranscriptText(videoId);
  if (!transcriptText || transcriptText.length < 50) return null;
  const ingredients = parseTranscriptForIngredients(transcriptText);
  if (ingredients.length === 0) return null;
  return {
    title: "Recipe from YouTube",
    ingredients,
    steps: [],
  };
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

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const url = typeof req.query.url === "string" ? req.query.url : null;
  if (!url || !url.startsWith("http")) {
    return res.status(400).json({ error: "Missing or invalid url" });
  }

  const youtubeApiKey = process.env.YOUTUBE_API_KEY ?? "";
  const videoId = getYouTubeVideoId(url);

  if (videoId) {
    try {
      if (youtubeApiKey) {
        const recipe = await fetchYouTubeRecipe(videoId, youtubeApiKey);
        if (
          recipe &&
          (recipe.ingredients.length > 0 || recipe.steps.length > 0)
        ) {
          return res.status(200).json(recipe);
        }
      }
      const fromTranscript = await fetchYouTubeRecipeFromTranscript(videoId);
      if (fromTranscript && fromTranscript.ingredients.length > 0) {
        return res.status(200).json(fromTranscript);
      }
    } catch {
      // fall through to generic fetch
    }
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
    return res
      .status(500)
      .json({ error: e instanceof Error ? e.message : String(e) });
  }
}
