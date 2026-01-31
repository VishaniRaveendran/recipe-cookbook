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

/** Browser-like User-Agent and headers so Instagram/TikTok/Facebook may serve og:image and full HTML. */
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

/** Fetch image from URL and return base64 string. */
async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      headers: BROWSER_HEADERS,
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

/** Full video analysis prompt: watch entire video, extract quantities, steps, equipment. */
const VIDEO_PROMPT = `CRITICAL INSTRUCTIONS - READ CAREFULLY:

1. WATCH THE ENTIRE VIDEO FROM START TO FINISH
   - DO NOT skip any parts
   - Watch every single frame carefully
   - Ingredients may appear at ANY point in the video

2. IDENTIFY EVERY INGREDIENT
   - Look for ingredients being shown, added, or mentioned
   - Note EXACT brand names if visible on packaging
   - Include garnishes, toppings, and optional ingredients
   - Don't miss any ingredient, even if shown briefly

3. EXTRACT EXACT QUANTITIES AND MEASUREMENTS
   - Look for measuring cups, spoons, scales showing numbers
   - Read any text overlays showing measurements
   - If you see "1 cup", "2 tablespoons", "500g" - record it EXACTLY
   - If quantity is not clearly shown, estimate based on visual size:
     * Small pinch, medium handful, large bowl, etc.
   - NEVER say "to taste" unless the chef specifically says that
   - Format: "2 cups", "1 tablespoon", "500 grams", "1/2 teaspoon"

4. EXTRACT PORTION/SERVING SIZE
   - Count how many plates/bowls are being filled
   - Look for chef mentioning "serves 4" or "makes 12 cookies"
   - Estimate based on final dish size if not mentioned

5. RECORD EVERY COOKING STEP IN ORDER
   - Watch what the chef DOES, not just what they say
   - Include techniques: "whisk", "fold", "sauté", "simmer"
   - Include all timings: "cook for 5 minutes", "bake until golden"
   - Include temperatures: "350°F", "medium-high heat"

6. IMPORTANT - ONLY USE VISUAL INFORMATION
   - DO NOT use video title, description, or captions
   - ONLY extract what you SEE and HEAR in the video itself
   - If ingredients are blocked or unclear, mark as "amount not visible"

Return ONLY valid JSON (no markdown, no code blocks, no extra text):

{
  "title": "Descriptive recipe name based on what's being made",
  "servings": "number of servings or portions (e.g., '4 servings', '12 cookies')",
  "cookingTime": "total time from start to finish (e.g., '30 minutes', '1 hour 15 minutes')",
  "prepTime": "preparation time if mentioned separately",
  "temperature": "oven/cooking temperature if shown (e.g., '350°F (175°C)', 'medium heat')",
  "ingredients": [
    {
      "name": "ingredient name (be specific: 'all-purpose flour' not just 'flour')",
      "quantity": "EXACT amount with unit (e.g., '2 cups', '1 tablespoon', '500g')",
      "notes": "any special notes (e.g., 'softened', 'room temperature', 'divided')"
    }
  ],
  "instructions": [
    "Detailed step 1 with timing and technique",
    "Detailed step 2 with timing and technique"
  ],
  "notes": "Any tips, tricks, or important observations from the video",
  "equipment": ["list of equipment used: 'mixing bowl', 'whisk', 'baking sheet', etc."]
}

NOW ANALYZE THE VIDEO:`;

/** Parsed full recipe from video (new prompt format). */
interface VideoRecipeParsed {
  title?: string;
  servings?: string;
  cookingTime?: string;
  prepTime?: string;
  temperature?: string;
  ingredients?: Array<{ name?: string; quantity?: string; notes?: string }>;
  instructions?: string[];
  notes?: string;
  equipment?: string[];
}

/** Categorize ingredient name to supermarket aisle (keyword match). */
function categorizeIngredientToAisle(name: string): string {
  const lower = name.toLowerCase();
  if (/\b(onion|garlic|tomato|lettuce|carrot|celery|potato|lemon|lime|apple|banana|avocado|pepper|broccoli|spinach|kale|herb|basil|parsley|cilantro|ginger|cucumber|zucchini|mushroom|scallion|shallot)\b/.test(lower)) return "Produce";
  if (/\b(milk|cream|butter|cheese|yogurt|egg)\b/.test(lower)) return "Dairy";
  if (/\b(chicken|beef|pork|bacon|sausage|turkey|lamb|fish|salmon|shrimp|meat)\b/.test(lower)) return "Meat";
  if (/\b(oil|vinegar|salt|sugar|flour|rice|pasta|noodle|sauce|soy|broth|stock|canned|beans|lentil|spice|paprika|cumin|oregano|nut|honey|maple|mustard|ketchup|breadcrumb|baking|vanilla|chocolate|coconut|almond|peanut)\b/.test(lower)) return "Pantry";
  if (/\b(bread|tortilla|wrap|pita)\b/.test(lower)) return "Bakery";
  if (/\b(frozen|ice)\b/.test(lower)) return "Frozen";
  return "Other";
}

/** Call Gemini API with YouTube video URL (actual video analysis). Returns full recipe in new format. */
async function getRecipeFromYouTubeVideoWithGemini(
  youtubeUrl: string,
  apiKey: string
): Promise<VideoRecipeParsed | null> {
  if (!apiKey) return null;
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  // Gemini docs: place video part FIRST, then text prompt.
  const body = {
    contents: [
      {
        parts: [
          { file_data: { file_uri: youtubeUrl } },
          { text: VIDEO_PROMPT },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
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
    return null;
  }
  if (data.error?.message) {
    console.error("[parse] Gemini YouTube video API error:", data.error.message);
    return null;
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  if (!text) {
    console.error("[parse] Gemini YouTube: empty response text. finishReason:", (data.candidates?.[0] as { finishReason?: string })?.finishReason);
    return null;
  }
  // Robust JSON extraction: strip markdown code blocks, then find outermost { }
  let cleaned = text
    .replace(/^[\s\S]*?```(?:json)?\s*/i, "")
    .replace(/\s*```[\s\S]*$/i, "")
    .trim();
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace === -1) {
    console.error("[parse] Gemini YouTube: no JSON object in response");
    return null;
  }
  let depth = 0;
  let end = -1;
  for (let i = firstBrace; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth++;
    else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) end = cleaned.length;
  cleaned = cleaned.slice(firstBrace, end + 1);
  try {
    const parsed = JSON.parse(cleaned) as VideoRecipeParsed;
    return parsed;
  } catch (parseErr) {
    console.error("[parse] Gemini YouTube: JSON parse failed", parseErr);
    return null;
  }
}

/** Map VideoRecipeParsed to ingredients string[], steps, servings. Returns flat ingredients list only (no aisle grouping). */
function mapVideoRecipeToResponse(
  parsed: VideoRecipeParsed,
  fallbackTitle: string,
  fallbackImageUrl?: string
): ParseResponse {
  const title = (parsed.title && String(parsed.title).trim()) || fallbackTitle;
  const ingredientsRaw = parsed.ingredients ?? [];
  const ingredients: string[] = [];
  const seen = new Set<string>();
  for (const ing of ingredientsRaw) {
    // Support { name }, { name, quantity }, { name, quantity, notes }, or string
    const name =
      typeof ing === "string"
        ? String(ing).trim()
        : ing?.name
          ? String(ing.name).trim()
          : "";
    if (!name) continue;
    const quantity = ing && typeof ing === "object" && ing.quantity ? String(ing.quantity).trim() : "";
    const notes = ing && typeof ing === "object" && ing.notes ? String(ing.notes).trim() : "";
    const line = [quantity, name].filter(Boolean).join(" ") + (notes ? ` (${notes})` : "");
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ingredients.push(line);
  }
  const steps =
    Array.isArray(parsed.instructions)
      ? parsed.instructions.filter((s): s is string => typeof s === "string").slice(0, 50)
      : Array.isArray((parsed as { steps?: string[] }).steps)
        ? (parsed as { steps: string[] }).steps.filter((s): s is string => typeof s === "string").slice(0, 50)
        : [];
  const servingsMatch = parsed.servings && String(parsed.servings).match(/\d+/);
  const servings = servingsMatch ? parseInt(servingsMatch[0], 10) : 4;
  const response: ParseResponse = {
    title,
    imageUrl: fallbackImageUrl,
    ingredients,
    steps,
    servings: Number.isFinite(servings) && servings > 0 ? servings : 4,
    groceryByAisle: [], // Flat list only; no aisle grouping.
  };
  const out = response as ParseResponse & Record<string, unknown>;
  if (parsed.cookingTime) out.cookingTime = parsed.cookingTime;
  if (parsed.prepTime) out.prepTime = parsed.prepTime;
  if (parsed.temperature) out.temperature = parsed.temperature;
  if (parsed.notes) out.notes = parsed.notes;
  if (Array.isArray(parsed.equipment) && parsed.equipment.length > 0) out.equipment = parsed.equipment;
  return response;
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
  let cleaned = text.replace(/^[\s\S]*?(\{|\[)/, "$1").replace(/(\}|\])[\s\S]*$/, "$1").trim();
  if (cleaned.startsWith("[")) cleaned = `{"ingredients":${cleaned},"steps":[]}`;
  try {
    const parsed = JSON.parse(cleaned) as {
      ingredients?: Array<{ name?: string; aisle?: string; quantity?: string; notes?: string }>;
      steps?: string[];
      instructions?: string[];
    };
    const raw = parsed.ingredients ?? [];
    const steps = Array.isArray(parsed.instructions)
      ? parsed.instructions.filter((s): s is string => typeof s === "string").slice(0, 30)
      : Array.isArray(parsed.steps)
        ? parsed.steps.filter((s): s is string => typeof s === "string").slice(0, 30)
        : [];
    type Ing = { name: string; aisle?: string; quantity?: string; notes?: string };
    const withAisle = raw
      .filter(
        (x): x is Ing =>
          x != null && typeof x.name === "string" && String(x.name).trim().length > 0
      )
      .map((x: Ing) => {
        const nameStr = String(x.name).trim();
        const q = x.quantity && String(x.quantity).trim();
        const n = x.notes && String(x.notes).trim();
        const name = q ? `${q} ${nameStr}${n ? ` (${n})` : ""}` : nameStr + (n ? ` (${n})` : "");
        const aisle =
          typeof x.aisle === "string" && AISLES.includes(x.aisle as (typeof AISLES)[number])
            ? x.aisle
            : categorizeIngredientToAisle(nameStr);
        return { name, aisle };
      });
    const ingredients = withAisle.filter((x) => x.name.length > 0);
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

  if (!geminiKey) {
    console.error("[parse] GEMINI_API_KEY is not set in Vercel environment. Set it in Project Settings → Environment Variables and redeploy.");
  }

  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const recipe = extractFromHtml(html, isVideo);
    const ogDescription = extractOgDescription(html);

    // For YouTube URLs: Gemini analyzes the actual video (video part first, then prompt).
    if (geminiKey && isYouTubeUrl(url)) {
      const fromVideo = await getRecipeFromYouTubeVideoWithGemini(url, geminiKey);
      if (fromVideo && (fromVideo.ingredients?.length ?? 0) > 0) {
        const responsePayload = mapVideoRecipeToResponse(
          fromVideo,
          recipe.title,
          recipe.imageUrl
        );
        return res.status(200).json(responsePayload);
      }
      if (fromVideo && (fromVideo.ingredients?.length ?? 0) === 0) {
        console.error("[parse] YouTube video analysis returned empty ingredients. Check Vercel logs for Gemini errors.");
      } else if (!fromVideo) {
        console.error("[parse] YouTube video analysis returned null (parse error or Gemini API failure). Check Vercel logs.");
      }
    }

    // Fallback: use preview image (thumbnail) for video/social URLs or when YouTube video path failed.
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
          const responsePayload: ParseResponse = {
            title: recipe.title,
            imageUrl: recipe.imageUrl,
            ingredients,
            steps: aiSteps.length > 0 ? aiSteps : recipe.steps,
            servings: recipe.servings,
            groceryByAisle: [], // Flat list only; no aisle grouping.
          };
          return res.status(200).json(responsePayload);
        }
        console.error("[parse] Thumbnail vision returned no ingredients.");
      } else {
        console.error("[parse] Could not fetch thumbnail image from", recipe.imageUrl?.slice(0, 50));
      }
    }

    // No Gemini key, or both video and thumbnail paths returned nothing.
    const responsePayload: ParseResponse = {
      ...recipe,
      groceryByAisle: [],
    };
    if (!geminiKey) {
      (responsePayload as ParseResponse & Record<string, unknown>).error = "GEMINI_API_KEY not set. Add it in Vercel → Settings → Environment Variables and redeploy.";
    }
    return res.status(200).json(responsePayload);
  } catch (e) {
    return res
      .status(500)
      .json({ error: e instanceof Error ? e.message : String(e) });
  }
}
