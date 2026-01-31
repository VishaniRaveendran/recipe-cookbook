import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Aisle names for supermarket categorization (must match app GroceryCategory). */
const AISLES = [
  "Produce",
  "Dairy",
  "Meat",
  "Pantry",
  "Bakery",
  "Frozen",
  "Other",
] as const;

interface ParsedRecipe {
  title: string;
  imageUrl?: string;
  ingredients: string[];
  steps: string[];
  servings?: number;
}

/** Grocery list grouped by supermarket aisle. */
export interface GroceryByAisle {
  aisle: string;
  items: string[];
}

interface ParseResponse extends ParsedRecipe {
  groceryByAisle?: GroceryByAisle[];
}

/** Extract og:title from HTML (YouTube and others often set this with the real video/page title). */
function extractOgTitle(html: string): string | undefined {
  const m =
    html.match(
      /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i
    ) ??
    html.match(
      /<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i
    );
  if (!m || !m[1]) return undefined;
  return m[1].trim().replace(/&[^;]+;/g, " ").slice(0, 300) || undefined;
}

function extractFromHtml(html: string, isVideoOrSocialUrl: boolean): ParsedRecipe {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  let title = titleMatch
    ? titleMatch[1].trim().replace(/&[^;]+;/g, " ")
    : "Untitled Recipe";
  const ogTitle = extractOgTitle(html);
  if (ogTitle && (title === "- YouTube" || title === "YouTube" || title.length < 3)) {
    title = ogTitle;
  }

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
        const servings =
          typeof recipe.recipeYield === "number"
            ? recipe.recipeYield
            : typeof recipe.recipeYield === "string"
            ? parseInt(recipe.recipeYield, 10)
            : 4;
        return {
          title: recipe.name ?? title,
          imageUrl: recipe.image?.[0] ?? recipe.image ?? imageUrl,
          ingredients,
          steps: steps.filter(Boolean),
          servings: Number.isFinite(servings) ? servings : 4,
        };
      }
    } catch {
      // fall through
    }
  }

  // For video/social URLs (YouTube, TikTok, Instagram), do not use page <ul> as ingredients.
  const ingredients: string[] = [];
  if (!isVideoOrSocialUrl) {
    const listMatch = html.match(/<ul[^>]*>([\s\S]*?)<\/ul>/gi);
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
  }

  return { title, imageUrl, ingredients, steps: [], servings: 4 };
}

/** Extract og:description from HTML for optional context to AI. */
function extractOgDescription(html: string): string | undefined {
  const m =
    html.match(
      /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i
    ) ??
    html.match(
      /<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i
    );
  if (!m || !m[1]) return undefined;
  const raw = m[1].trim().replace(/&[^;]+;/g, " ").slice(0, 2000);
  return raw || undefined;
}

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function isVideoOrSocialUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    return (
      h.includes("youtube.com") ||
      h.includes("youtu.be") ||
      h.includes("tiktok.com") ||
      h.includes("instagram.com") ||
      h.includes("facebook.com") ||
      h.includes("fb.watch") ||
      h.includes("fb.com")
    );
  } catch {
    return false;
  }
}

/** True if URL is a public YouTube watch or short link (Gemini can accept these as video input). */
function isYouTubeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (h === "www.youtube.com" || h === "youtube.com")
      return u.pathname === "/watch" && u.searchParams.has("v");
    if (h === "youtu.be") return u.pathname.length > 1;
    return false;
  } catch {
    return false;
  }
}

/** Fetch image from URL and return base64 string. */
async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RecipeParser/1.0)" },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    return base64 || null;
  } catch {
    return null;
  }
}

const VISION_PROMPT = `You are analyzing a preview image (and optional text) from a recipe or cooking video (YouTube, TikTok, Instagram, or similar).

Tasks:
1. List every ingredient you can identify from the image or implied by the recipe/video. Use short grocery-style labels (e.g. "tomatoes", "olive oil", "fresh basil").
2. For each ingredient, assign exactly one supermarket aisle. Use ONLY one of these exact names: Produce, Dairy, Meat, Pantry, Bakery, Frozen, Other.

Respond with ONLY a valid JSON object, no markdown or explanation. Format:
{
  "ingredients": [
    { "name": "ingredient name", "aisle": "Produce" },
    { "name": "another ingredient", "aisle": "Pantry" }
  ],
  "steps": ["optional step 1", "optional step 2"]
}
If you cannot determine steps, omit "steps" or use an empty array. Every ingredient must have "name" and "aisle".`;

/** Prompt when Gemini receives the actual video (YouTube URL); same output format. */
const VIDEO_PROMPT = `You are analyzing a cooking or recipe video.

Tasks:
1. List every ingredient you can identify from the video (what is shown or mentioned). Use short grocery-style labels (e.g. "tomatoes", "olive oil", "fresh basil").
2. For each ingredient, assign exactly one supermarket aisle. Use ONLY one of these exact names: Produce, Dairy, Meat, Pantry, Bakery, Frozen, Other.

Respond with ONLY a valid JSON object, no markdown or explanation. Format:
{
  "ingredients": [
    { "name": "ingredient name", "aisle": "Produce" },
    { "name": "another ingredient", "aisle": "Pantry" }
  ],
  "steps": ["optional step 1", "optional step 2"]
}
If you cannot determine steps, omit "steps" or use an empty array. Every ingredient must have "name" and "aisle".`;

/** Call Gemini API with YouTube video URL (actual video analysis, not thumbnail). Returns ingredients with aisle and optional steps. */
async function getRecipeFromYouTubeVideoWithGemini(
  youtubeUrl: string,
  apiKey: string
): Promise<{ ingredients: { name: string; aisle: string }[]; steps: string[] }> {
  if (!apiKey) return { ingredients: [], steps: [] };
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [
      {
        parts: [
          { text: VIDEO_PROMPT },
          { file_data: { file_uri: youtubeUrl } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  };
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string; code?: number };
  };
  if (!res.ok) {
    console.error("[parse] Gemini YouTube video error:", res.status, data.error?.message ?? (data as { error?: { message?: string } }).error);
    return { ingredients: [], steps: [] };
  }
  if (data.error?.message) {
    console.error("[parse] Gemini YouTube video API error:", data.error.message);
    return { ingredients: [], steps: [] };
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  if (!text) return { ingredients: [], steps: [] };
  const cleaned = text
    .replace(/^[\s\S]*?\{/, "{")
    .replace(/\}[\s\S]*$/, "}")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      ingredients?: Array<{ name?: string; aisle?: string }>;
      steps?: string[];
    };
    const ingredients = (parsed.ingredients ?? [])
      .filter(
        (x): x is { name: string; aisle: string } =>
          x != null &&
          typeof x.name === "string" &&
          typeof x.aisle === "string"
      )
      .map((x) => ({
        name: String(x.name).trim(),
        aisle: AISLES.includes(x.aisle as (typeof AISLES)[number])
          ? x.aisle
          : "Other",
      }))
      .filter((x) => x.name.length > 0);
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps.filter((s): s is string => typeof s === "string").slice(0, 30)
      : [];
    return { ingredients, steps };
  } catch {
    return { ingredients: [], steps: [] };
  }
}

/** Call Gemini multimodal API: image + optional text. Returns ingredients with aisle and optional steps. */
async function getRecipeFromImageWithGemini(
  base64Image: string,
  mimeType: string,
  apiKey: string,
  optionalText?: string
): Promise<{ ingredients: { name: string; aisle: string }[]; steps: string[] }> {
  if (!apiKey) return { ingredients: [], steps: [] };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
  const parts: unknown[] = [
    {
      inline_data: {
        mime_type: mimeType,
        data: base64Image,
      },
    },
    { text: VISION_PROMPT },
  ];
  if (optionalText && optionalText.trim()) {
    parts.splice(1, 0, {
      text: `Optional context from the page:\n${optionalText.slice(0, 1500)}\n\n`,
    });
  }
  const body = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ingredients: [], steps: [] };
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  if (!text) return { ingredients: [], steps: [] };
  const cleaned = text
    .replace(/^[\s\S]*?\{/, "{")
    .replace(/\}[\s\S]*$/, "}")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as {
      ingredients?: Array<{ name?: string; aisle?: string }>;
      steps?: string[];
    };
    const ingredients = (parsed.ingredients ?? [])
      .filter(
        (x): x is { name: string; aisle: string } =>
          x != null &&
          typeof x.name === "string" &&
          typeof x.aisle === "string"
      )
      .map((x) => ({
        name: String(x.name).trim(),
        aisle: AISLES.includes(x.aisle as (typeof AISLES)[number])
          ? x.aisle
          : "Other",
      }))
      .filter((x) => x.name.length > 0);
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps.filter((s): s is string => typeof s === "string").slice(0, 30)
      : [];
    return { ingredients, steps };
  } catch {
    return { ingredients: [], steps: [] };
  }
}

/** Build groceryByAisle from ingredients with aisle, ordered by AISLES. */
function buildGroceryByAisle(
  items: { name: string; aisle: string }[]
): GroceryByAisle[] {
  const byAisle = new Map<string, string[]>();
  for (const a of AISLES) byAisle.set(a, []);
  const seen = new Set<string>();
  for (const { name, aisle } of items) {
    const key = name.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    const a = AISLES.includes(aisle as (typeof AISLES)[number]) ? aisle : "Other";
    const list = byAisle.get(a) ?? [];
    list.push(name);
    byAisle.set(a, list);
  }
  return AISLES.map((aisle) => ({
    aisle,
    items: byAisle.get(aisle) ?? [],
  })).filter((g) => g.items.length > 0);
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

  const isVideo = isVideoOrSocialUrl(url);
  const geminiKey = process.env.GEMINI_API_KEY ?? "";

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RecipeParser/1.0)" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const recipe = extractFromHtml(html, isVideo);
    const ogDescription = extractOgDescription(html);

    // For YouTube URLs: Gemini can analyze the actual video (audio + frames). Try that first.
    if (geminiKey && isYouTubeUrl(url)) {
      const fromVideo = await getRecipeFromYouTubeVideoWithGemini(url, geminiKey);
      if (fromVideo.ingredients.length > 0) {
        const ingredients = fromVideo.ingredients.map((x) => x.name);
        const groceryByAisle = buildGroceryByAisle(fromVideo.ingredients);
        const responsePayload: ParseResponse = {
          title: recipe.title,
          imageUrl: recipe.imageUrl,
          ingredients,
          steps: fromVideo.steps.length > 0 ? fromVideo.steps : recipe.steps,
          servings: recipe.servings,
          groceryByAisle,
        };
        return res.status(200).json(responsePayload);
      }
    }

    // For other video/social URLs or when YouTube video analysis failed: use preview image (thumbnail).
    const shouldUseVision =
      geminiKey &&
      recipe.imageUrl &&
      recipe.imageUrl.startsWith("http") &&
      (isVideo || recipe.ingredients.length < 5);

    if (shouldUseVision) {
      const base64 = await fetchImageAsBase64(recipe.imageUrl!);
      if (base64) {
        const { ingredients: aiIngredients, steps: aiSteps } =
          await getRecipeFromImageWithGemini(
            base64,
            "image/jpeg",
            geminiKey,
            ogDescription
          );
        if (aiIngredients.length > 0) {
          const ingredients = aiIngredients.map((x) => x.name);
          const groceryByAisle = buildGroceryByAisle(aiIngredients);
          const responsePayload: ParseResponse = {
            title: recipe.title,
            imageUrl: recipe.imageUrl,
            ingredients,
            steps: aiSteps.length > 0 ? aiSteps : recipe.steps,
            servings: recipe.servings,
            groceryByAisle,
          };
          return res.status(200).json(responsePayload);
        }
      }
    }

    // No vision or vision returned nothing: return HTML-extracted recipe; add empty groceryByAisle if desired.
    const responsePayload: ParseResponse = {
      ...recipe,
      groceryByAisle: [],
    };
    return res.status(200).json(responsePayload);
  } catch (e) {
    return res
      .status(500)
      .json({ error: e instanceof Error ? e.message : String(e) });
  }
}
