/**
 * Vision Ingredients Service: send a cooking frame to an AI Vision API
 * (Gemini or OpenAI) and get a structured list of ingredients with confidence scores.
 * Maps results to the app's GroceryList schema (GroceryItem + confidence).
 */

import { getCategoryForIngredient } from "@/lib/groceryCategories";
import type { DetectedGroceryItem } from "@/types";

const VISION_PROVIDER =
  (process.env.EXPO_PUBLIC_VISION_PROVIDER as "gemini" | "openai") ?? "gemini";
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "";
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? "";

const INGREDIENTS_PROMPT = `CRITICAL INSTRUCTIONS - READ CAREFULLY:

1. WATCH THE ENTIRE VIDEO FROM START TO FINISH (or analyze every part of the image)
   - DO NOT skip any parts
   - Ingredients may appear at ANY point

2. IDENTIFY EVERY INGREDIENT
   - Look for ingredients being shown, added, or mentioned
   - Note EXACT brand names if visible on packaging
   - Include garnishes, toppings, and optional ingredients

3. EXTRACT EXACT QUANTITIES AND MEASUREMENTS when visible
   - Look for measuring cups, spoons, scales, text overlays
   - If you see "1 cup", "2 tablespoons", "500g" - record it EXACTLY
   - If quantity is not visible, estimate: small pinch, medium handful, etc.
   - Format: "2 cups", "1 tablespoon", "500 grams"

4. IMPORTANT - ONLY USE VISUAL INFORMATION from the frame(s) or image
   - If ingredients are blocked or unclear, use "amount not visible"

Return ONLY valid JSON (no markdown, no code blocks):

{
  "title": "Descriptive recipe name based on what's being made",
  "servings": "e.g. '4 servings' or '12 cookies'",
  "ingredients": [
    {
      "name": "ingredient name (specific: 'all-purpose flour' not just 'flour')",
      "quantity": "EXACT amount with unit (e.g. '2 cups', '1 tablespoon')",
      "notes": "e.g. 'softened', 'room temperature'"
    }
  ],
  "instructions": ["Step 1 with timing and technique", "Step 2", "..."],
  "equipment": ["mixing bowl", "whisk", "baking sheet", "..."]
}

NOW ANALYZE THE VIDEO/IMAGE:`;

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Normalize base64 input: strip data URL prefix if present, return raw base64 and mime. */
function parseImageInput(
  imageBase64OrDataUrl: string
): { base64: string; mimeType: string } {
  const trimmed = imageBase64OrDataUrl.trim();
  const dataUrlMatch = trimmed.match(/^data:([^;]+);base64,(.+)$/);
  if (dataUrlMatch) {
    return {
      mimeType: dataUrlMatch[1] || "image/jpeg",
      base64: dataUrlMatch[2] || trimmed,
    };
  }
  return { base64: trimmed, mimeType: "image/jpeg" };
}

/** Parse AI response: supports (1) array of { name, confidence } or (2) full recipe object with ingredients: [{ name, quantity, notes }]. */
function parseIngredientsResponse(text: string): { name: string; confidence: number }[] {
  const cleaned = text
    .replace(/^[\s\S]*?(\[|\{)/, "$1")
    .replace(/(\]|\})[\s\S]*$/, "$1")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    // New format: object with ingredients: [{ name, quantity, notes }]
    if (
      parsed != null &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { ingredients?: unknown }).ingredients)
    ) {
      const ingredients = (parsed as { ingredients: Array<{ name?: string; quantity?: string; notes?: string }> }).ingredients;
      return ingredients
        .filter(
          (ing): ing is { name: string; quantity?: string; notes?: string } =>
            ing != null && typeof ing.name === "string" && String(ing.name).trim().length > 0
        )
        .map((ing) => {
          const name = String(ing.name).trim();
          const quantity = ing.quantity ? String(ing.quantity).trim() : "";
          const notes = ing.notes ? String(ing.notes).trim() : "";
          const line = [quantity, name].filter(Boolean).join(" ") + (notes ? ` (${notes})` : "");
          return { name: line, confidence: 0.9 };
        });
    }
    // Old format: array of { name, confidence }
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is { name: string; confidence?: number } =>
          item != null &&
          typeof item === "object" &&
          typeof (item as { name?: unknown }).name === "string"
      )
      .map((item) => ({
        name: String(item.name).trim(),
        confidence:
          typeof item.confidence === "number" && item.confidence >= 0 && item.confidence <= 1
            ? item.confidence
            : 0.8,
      }))
      .filter((item) => item.name.length > 0);
  } catch {
    return [];
  }
}

/** Call Google Gemini vision API. */
async function callGemini(
  base64: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("EXPO_PUBLIC_GEMINI_API_KEY is not set");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: base64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${err}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  return text;
}

/** Call OpenAI Chat Completions vision API. */
async function callOpenAI(
  base64: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error("EXPO_PUBLIC_OPENAI_API_KEY is not set");
  const dataUrl = `data:${mimeType};base64,${base64}`;
  const url = "https://api.openai.com/v1/chat/completions";
  const body = {
    model: "gpt-4o-mini",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: dataUrl, detail: "low" },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  return text;
}

/**
 * Detect ingredients from an image using the configured Vision API.
 * @param imageBase64OrDataUrl - Raw base64 string or data URL (e.g. from ImagePicker with base64)
 * @returns Array of DetectedGroceryItem (GroceryItem + confidence) mapped to your GroceryList schema
 */
export async function detectIngredientsFromImage(
  imageBase64OrDataUrl: string
): Promise<DetectedGroceryItem[]> {
  const { base64, mimeType } = parseImageInput(imageBase64OrDataUrl);
  if (!base64) throw new Error("Image data is empty");

  const prompt = INGREDIENTS_PROMPT;
  const rawText =
    VISION_PROVIDER === "openai"
      ? await callOpenAI(base64, mimeType, prompt)
      : await callGemini(base64, mimeType, prompt);

  const parsed = parseIngredientsResponse(rawText);
  const seen = new Set<string>();
  const items: DetectedGroceryItem[] = [];

  for (const { name, confidence } of parsed) {
    const key = name.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: generateId(),
      name,
      category: getCategoryForIngredient(name),
      checked: false,
      confidence,
    });
  }

  return items;
}

/**
 * Test Gemini API connection (text-only, no image). Use this to verify EXPO_PUBLIC_GEMINI_API_KEY.
 */
export async function testGeminiConnection(): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!GEMINI_API_KEY) {
    return { ok: false, error: "EXPO_PUBLIC_GEMINI_API_KEY is not set in .env" };
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [{ parts: [{ text: "Reply with exactly: OK" }] }],
    generationConfig: { maxOutputTokens: 10 },
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      if (res.status === 429) {
        try {
          const parsed = JSON.parse(err) as { error?: { message?: string } };
          const msg = parsed.error?.message ?? "Quota exceeded";
          return {
            ok: false,
            error: "Quota exceeded. The free tier has daily limits. Try again tomorrow or check your plan at https://ai.google.dev/gemini-api.",
          };
        } catch {
          return { ok: false, error: "Quota exceeded. Try again later or check your API plan." };
        }
      }
      return { ok: false, error: `HTTP ${res.status}: ${err.slice(0, 200)}` };
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    };
    if (data.error?.message) {
      return { ok: false, error: data.error.message };
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    return { ok: !!text, error: text ? undefined : "Empty response" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
