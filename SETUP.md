# Step-by-step setup guide

Follow these steps to get the app running with Supabase, optional recipe parsing API, and RevenueCat.

---

## 1. Copy `.env.example` to `.env` and set Supabase URL + anon key

### 1.1 Create your `.env` file

In the project root, run:

```bash
cp .env.example .env
```

Or manually: duplicate `.env.example`, rename the copy to `.env`.

### 1.2 Create a Supabase project (if you don’t have one)

1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Choose your **organization**, set a **name** and **database password** (save the password).
4. Pick a **region** and click **Create new project**.
5. Wait until the project is ready (green status).

### 1.3 Get your Supabase URL and anon key

1. In the Supabase dashboard, open your project.
2. In the left sidebar, click **Project Settings** (gear icon).
3. Click **API** in the left menu.
4. Under **Project URL**, copy the URL (e.g. `https://xxxxxxxxxxxx.supabase.co`).
5. Under **Project API keys**, find **anon** **public** and click **Reveal** (or copy). Copy the full key.

### 1.4 Put them in `.env`

Open `.env` and set:

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Replace with your actual **Project URL** and **anon** key. Save the file.

---

## 2. In Supabase: run `001_initial.sql`, enable Email (and optionally Anonymous) auth

### 2.1 Run the migration

1. In the Supabase dashboard, open your project.
2. In the left sidebar, click **SQL Editor**.
3. Click **New query**.
4. Open `supabase/migrations/001_initial.sql` in your project and copy its full contents.
5. Paste into the SQL Editor.
6. Click **Run** (or press Cmd/Ctrl + Enter).
7. Confirm you see “Success. No rows returned” (or similar). Tables `recipes` and `grocery_lists` and RLS policies are now created.

### 2.2 Enable Email auth

1. In the left sidebar, click **Authentication**.
2. Click **Providers**.
3. Find **Email** and turn it **ON** if it isn’t already.
4. (Optional) Configure **Confirm email** and **Secure email change** as you like; for local/dev you can leave defaults.

### 2.3 (Optional) Enable Anonymous auth

1. Still under **Authentication** → **Providers**.
2. Find **Anonymous** (or “Anonymous sign-ins”).
3. Turn it **ON** if you want “no account first” flow (anonymous users get a session until they sign in with email).

Save any provider changes.

---

## 3. Optionally deploy `api/` to Vercel and set `EXPO_PUBLIC_PARSER_API_URL`

Only needed if you want the app to parse recipe URLs from websites (Instagram/YouTube often need manual entry either way).

### 3.1 Deploy the API to Vercel

1. Go to [https://vercel.com](https://vercel.com) and sign in (e.g. with GitHub).
2. Click **Add New** → **Project**.
3. Import your **Git repository** that contains this app (or upload the project).
4. Set **Root Directory** to this project root (where `api/` lives).
5. **Build and Output Settings:**
   - Framework Preset: **Other** (or leave default).
   - Build Command: leave empty or `echo 'no build'`.
   - Output Directory: leave empty.
6. Under **Environment Variables**, add nothing for now unless you need them for the API.
7. Click **Deploy**.
8. After deploy, open the project and copy the **Production URL** (e.g. `https://your-project.vercel.app`).

### 3.2 Point the API route correctly

Vercel serves files in `/api` as serverless functions. Your handler is in `api/parse.ts`, so the endpoint will be:

- `https://your-project.vercel.app/api/parse`

### 3.3 Set the URL in `.env`

In your project’s `.env` add or update:

```env
EXPO_PUBLIC_PARSER_API_URL=https://your-project.vercel.app
```

Do **not** include `/api/parse` — the app adds `/api/parse?url=...` itself.

**Example:** If your API is at `https://recipe-cookbook-six.vercel.app`, set:

```env
EXPO_PUBLIC_PARSER_API_URL=https://recipe-cookbook-six.vercel.app
```

**Test the API in a browser or terminal:**

```bash
curl "https://recipe-cookbook-six.vercel.app/api/parse?url=https://www.youtube.com/watch?v=VIDEO_ID"
```

You should get JSON with `title`, `ingredients`, and `steps`.

**If you get 404 NOT_FOUND:**

1. **Build settings** — In Vercel → **Settings** → **General** → **Build & Development Settings**: set **Framework Preset** to **Other** (not Expo). Clear **Build Command** and **Output Directory**. Set **Root Directory** to empty. Save, then **Redeploy**. When Expo is selected, Vercel can skip the `api/` folder.
2. **Root Directory** — Set to repo root (or leave empty). If it points to a subfolder (e.g. `app`), the `api/` folder at the root won’t be deployed.
3. **Commit and redeploy** — Ensure `api/parse.ts` and `vercel.json` are committed. Redeploy (Vercel → Deployments → ⋮ on latest → Redeploy).
4. **`vercel.json`** — The repo includes a `vercel.json` that registers `api/parse.ts` as a serverless function; keep it so `/api/parse` is served.

Restart Expo after changing `.env`:

```bash
npx expo start
```

### 3.4 (Optional) YouTube recipe extraction

To **auto-extract recipes from YouTube videos**, the parser API uses the **YouTube Data API v3** to read the video title and description (where creators often put ingredients and steps).

1. **Create a Google Cloud project**  
   Go to [Google Cloud Console](https://console.cloud.google.com/) → create or select a project.

2. **Enable YouTube Data API v3**  
   APIs & Services → **Library** → search **YouTube Data API v3** → **Enable**.

3. **Create an API key**  
   APIs & Services → **Credentials** → **Create credentials** → **API key**. Copy the key.

4. **Add the key in Vercel** (not in the app `.env`)  
   In your Vercel project: **Settings** → **Environment Variables** → add:

   - **Name:** `YOUTUBE_API_KEY`
   - **Value:** your API key  
     Redeploy the API so the new env is picked up.

5. **Use it in the app**  
   When `EXPO_PUBLIC_PARSER_API_URL` points to this Vercel API and `YOUTUBE_API_KEY` is set, pasting a YouTube link and tapping **Get recipe** will:
   - Call the API with the YouTube URL.
   - The API fetches the video’s title and description via YouTube Data API.
   - It parses the description for **Ingredients** and **Instructions** sections (bullets, numbers, common keywords) and returns title, ingredients, and steps.

**Tips:**

- Many creators put “INGREDIENTS” and “INSTRUCTIONS” (or “DIRECTIONS”) in the description; the parser looks for those.
- If the description has no clear sections, you’ll still get the video title and can add ingredients manually.
- YouTube Data API has a [daily quota](https://developers.google.com/youtube/v3/getting-started#quota); 1 request = 1 unit. For normal use you stay well under the free quota.

### 3.5 Multimodal AI (TikTok, Instagram, YouTube, and any URL)

The parser API can also **analyse the video’s captions/transcript** to extract ingredients from what the host says (e.g. “we need two cups of flour”). No API key is required for this.

- **How it works:** When you paste a YouTube URL and call the parser API, it (1) tries **description** first (with `YOUTUBE_API_KEY` if set) for title, thumbnail, and written ingredients; (2) if the description has few or no ingredients, it fetches the **video transcript** using the `multimodal AI (Gemini vision)` package (public captions); (3) it parses the transcript for ingredient-like phrases and merges them with description ingredients.
- **Transcript-only:** If you don’t set `YOUTUBE_API_KEY`, the API can still use **transcript only**: it fetches captions and extracts ingredients from the spoken text. You get “Recipe from YouTube” and a list of ingredients from the transcript.
- **Requirement:** The video must have **captions** (auto-generated or uploaded). If captions are disabled, only description (with API key) or manual entry in the app will work.

### 3.5a Vision fallback (ingredients from video frame)

When **description, transcript, and comments** don’t yield ingredients (or yield very few), the parse API can **use AI vision on the video thumbnail** to detect ingredients from the frame.

- **How it works:** The API fetches the YouTube thumbnail (maxresdefault or hqdefault), sends it to **Gemini** with a prompt to list visible ingredients/food, and merges the result into the recipe. No captions or description required.
- **Setup:** In **Vercel** → your project → **Settings** → **Environment Variables**, add:
  - **Name:** `GEMINI_API_KEY`
  - **Value:** your Gemini API key (same key as in section 3.6, or create one at [Google AI Studio](https://aistudio.google.com/app/apikey))
- **Redeploy** the API so the new env is picked up.
- **Order of fallbacks:** The API tries (1) description, (2) links in description, (3) comments, (4) **vision from thumbnail** (if `GEMINI_API_KEY` is set), then (5) transcript-only if no YouTube API key. So vision runs when text sources don’t give enough ingredients.

**Testing a YouTube URL with Gemini**

1. Deploy the parse API to Vercel and set `GEMINI_API_KEY` in the project environment variables (see above).
2. Call the API with the YouTube URL. To **force** Gemini vision on the thumbnail (skip transcript-only result), add `forceVision=1`:
   ```bash
   curl -s "https://YOUR_VERCEL_URL/api/parse?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DSd5SpMziJY4&forceVision=1"
   ```
   Replace `YOUR_VERCEL_URL` with your deployed API URL (e.g. `recipe-cookbook-six.vercel.app`). The response is JSON with `title`, `ingredients`, and `steps`; ingredients from the thumbnail come from Gemini.
3. Without `forceVision=1`, the API returns transcript-based ingredients when available and only uses Gemini when transcript yields few or no ingredients.

### 3.6 Get a free Gemini API key (for image → ingredients)

The app can send a **photo or video frame** to Google’s Gemini API and get a list of ingredients (e.g. from a cooking video or a photo of your fridge). This uses the **Gemini API** with a **free tier** (rate limits apply; no credit card required).

**Step 1 — Open Google AI Studio**

1. Go to **[https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)**.
2. Sign in with your **Google account** (Gmail).

**Step 2 — Create an API key**

1. On the **API keys** page, click **Create API key** (or **Get API key**).
2. Choose **Create API key in new project** (or pick an existing Google Cloud project if you have one).
3. After a few seconds, your key appears. Click **Copy** to copy it.  
   - Store it somewhere safe; you can’t see the full key again later (you can create a new key if needed).

**Step 3 — Put the key in your app**

1. Open your project’s **`.env`** file (in the project root).
2. Set (or add) this line; paste your key after the `=`:

```env
EXPO_PUBLIC_GEMINI_API_KEY=your-pasted-gemini-api-key
```

3. Save the file.

**Step 4 — Restart the app**

Restart Expo so it picks up the new env:

```bash
npx expo start
```

**Notes**

- **Free tier:** The Gemini API has a free tier with rate limits; no billing is required to try it.
- **Where it’s used:** The key is used by (1) the **Identify ingredients from photo or video** screen in the app (take/choose a photo or video, AI lists ingredients from the image or a frame); (2) optionally the **parse API** (Vercel): set the same key as **GEMINI_API_KEY** in Vercel so the API can detect ingredients from the page image or video thumbnail when description/captions/comments don’t (see 3.5a).
- **Optional:** If you prefer OpenAI for vision instead, set `EXPO_PUBLIC_VISION_PROVIDER=openai` and `EXPO_PUBLIC_OPENAI_API_KEY=your-openai-key` in `.env`.

### 3.6a Identify ingredients from any photo or video (in the app)

The app has an **Identify ingredients from photo or video** flow that uses AI on **any** image or video you choose (not only YouTube):

- **Where:** Recipes tab → **Identify ingredients from photo or video**.
- **What it does:** You can **take a photo**, **choose a photo**, or **choose a video** from your device. The app sends the image (or a frame from the video) to Gemini and shows a list of detected ingredients. You can then **Add to grocery list** or **Add to My Kitchen**.
- **Requirements:** `EXPO_PUBLIC_GEMINI_API_KEY` in `.env` (see 3.6). The flow uses `expo-image-picker`, `expo-video-thumbnails`, and `expo-file-system` (in `package.json`). Run `npm install` (or `npx expo install expo-image-picker expo-video-thumbnails expo-file-system`) if you added the project recently.
- **Video:** For video, the app extracts a frame at the start and sends it to AI. So any cooking video (from any app or camera) can be used to get ingredients from the frame.

---

## 4. Add RevenueCat API keys when testing paywall on device/simulator

RevenueCat only works on **iOS** and **Android** builds (not in web). You need an app in App Store Connect and/or Google Play for production; for the contest you can use **sandbox** with API keys.

### 4.0 Running in Expo Go: use the Test Store API key

When you run the app inside **Expo Go** (e.g. `npx expo start` and open in the Expo Go app), RevenueCat does **not** use the real App Store/Play Store. You must use RevenueCat’s **Test Store** API key instead, or you’ll see: _“Invalid API key. The native store is not available when running inside Expo Go…”_.

1. In the RevenueCat dashboard, go to **Apps and providers** (sidebar).
2. Under **Test configuration**, find or create a **Test Store** and copy its **API key**.
3. In your project’s `.env`, set:
   ```env
   EXPO_PUBLIC_REVENUECAT_API_KEY_TEST=your-test-store-api-key
   ```
4. The app automatically uses this key when running in Expo Go. Restart Expo after changing `.env`.

Configure test products and the **premium** entitlement for the Test Store in RevenueCat (Product catalog → Products / Offerings for the Test Store). Never ship a production build with the Test Store key; use iOS/Android keys for dev builds or release.

### 4.1 Create a RevenueCat account and project

1. Go to [https://app.revenuecat.com](https://app.revenuecat.com).
2. Sign up or sign in.
3. Create a **Project** (e.g. “Recipe Cookbook”).

### 4.2 Add iOS app (for simulator/device)

1. In RevenueCat, go to **Apps** and click **+ New**.
2. Select **Apple App Store**.
3. Enter your **App name** and **Bundle ID** (must match `app.json` / Expo config, e.g. `com.yourapp.receipecookbook`).
4. When prompted, add your **App Store Connect API Key** (or Shared Secret for older setup). For sandbox-only testing you may only need the API key from RevenueCat’s instructions.
5. Save. RevenueCat will show an **API Key** for this app — copy it; this is `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`.

### 4.3 Add Android app (optional, for device/emulator)

1. In RevenueCat, **Apps** → **+ New**.
2. Select **Google Play Store**.
3. Enter **App name** and **Package name** (must match your Android app id).
4. Add your **Google Play service account** JSON (RevenueCat docs explain how).
5. Save and copy the **API Key** for this app — this is `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID`.

### 4.4 Create products and entitlement in RevenueCat

1. In RevenueCat, go to **Products** and add your **monthly** and **yearly** subscription product IDs (same IDs as in App Store Connect / Google Play).
2. Go to **Entitlements** and create one entitlement, e.g. **premium** (must match `REVENUECAT_ENTITLEMENT_PREMIUM` in the app: `constants/limits.ts`).
3. Attach your products to this entitlement.
4. (Optional) In **Paywalls**, create a paywall or use the app’s custom paywall screen.

### 4.5 Put the keys in `.env`

In `.env`:

```env
# Required when running in Expo Go (see section 4.0)
EXPO_PUBLIC_REVENUECAT_API_KEY_TEST=your-test-store-api-key

# For development builds or release (iOS simulator/device, TestFlight, App Store)
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_xxxxxxxxxxxx
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_xxxxxxxxxxxx
```

- **Expo Go:** set `EXPO_PUBLIC_REVENUECAT_API_KEY_TEST` (Test Store key from Apps and providers → Test configuration).
- **Dev/release builds:** use the **Public API keys** from RevenueCat (one per platform). Leave the Android one empty if you’re only testing on iOS.

### 4.6 Test on device or simulator

1. Rebuild the app so it picks up the new env vars (e.g. `npx expo start` and then run on iOS/Android; for a dev build you may need `npx expo prebuild` and then run the native app).
2. Trigger the paywall (e.g. save 4th recipe or use Cook Tonight when over the free limit).
3. On **iOS**, use a **Sandbox** Apple ID (Settings → App Store → Sandbox Account) to complete a test purchase.
4. On **Android**, use a **license test** account in Google Play Console to test without charging.

---

## Quick checklist

- [ ] `.env` created from `.env.example`
- [ ] `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` set in `.env`
- [ ] Supabase: `001_initial.sql` run in SQL Editor
- [ ] Supabase: Email auth enabled (and optionally Anonymous)
- [ ] (Optional) API deployed to Vercel and `EXPO_PUBLIC_PARSER_API_URL` set in `.env`
- [ ] RevenueCat project and iOS (and optionally Android) app added
- [ ] RevenueCat **premium** entitlement and products configured
- [ ] **Expo Go:** `EXPO_PUBLIC_REVENUECAT_API_KEY_TEST` set (Test Store key). **Dev/release:** `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` (and Android if needed) set in `.env`
- [ ] Paywall tested (Expo Go with Test Store, or device/simulator with sandbox/test account)

After any `.env` change, restart Expo: `npx expo start`.

---

## Troubleshooting: "Database API URL not working" (Supabase)

If the app can't reach the database (recipes/grocery list don't load, sign-in fails, or you see network/auth errors):

1. **Check `.env`**

   - You must have **both**:
     - `EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co`
     - `EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...`
   - Names must be **exact** (including `EXPO_PUBLIC_`). No spaces around `=`. No quotes unless the value has spaces.
   - Get them from [Supabase](https://supabase.com/dashboard) → your project → **Project Settings** (gear) → **API** → **Project URL** and **anon public** key.

2. **Restart Expo**

   - Env vars are read when the app starts. After changing `.env`, stop the dev server (Ctrl+C) and run `npx expo start` again.

3. **Supabase project paused**

   - Free-tier projects pause after inactivity. In the dashboard, if the project shows **Paused**, click **Restore project**.

4. **URL format**

   - Use `https://your-project-ref.supabase.co` (no trailing slash, no path like `/rest/v1`).

5. **Tables and RLS**
   - Run `supabase/migrations/001_initial.sql` in Supabase **SQL Editor** so `recipes` and `grocery_lists` exist and RLS is set. Enable **Anonymous** (and optionally Email) under **Authentication** → **Providers**.

---

## Troubleshooting: "Recipe and grocery list not saving"

If saving a recipe or adding to the grocery list does nothing or shows an error:

1. **"Please wait – Signing you in…"**  
   The app uses **anonymous sign-in** so you have a user without an account. If you see this when you tap Save:

   - **Enable Anonymous auth** in Supabase: **Authentication** → **Providers** → **Anonymous** → turn **ON**.
   - Wait a few seconds and try again (sign-in runs when the app loads).

2. **"Could not save recipe" with an error message**  
   Check the exact message:

   - **"new row violates row-level security policy"** or **"permission denied"** → You ran the migration and RLS is on, but `auth.uid()` doesn’t match. Ensure Anonymous (or Email) auth is enabled and that you’re not blocking anonymous users in RLS.
   - **"relation \"recipes\" does not exist"** → Run `supabase/migrations/001_initial.sql` in the Supabase **SQL Editor** (see section 2.1).
   - **"Failed to fetch"** or **"Network request failed"** → Check `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`. Restart Expo after changing `.env`.

3. **Nothing happens when you tap Save**
   - You should now see either "Please wait…" (no user yet) or an error alert (Supabase/RLS). If you still see nothing, check the Metro/Expo logs for JavaScript errors.

---

## "Get recipe" / YouTube links

**YouTube and Instagram** don’t expose the full recipe in the page HTML, so the app often can’t auto-extract ingredients from those links.

- **Without a parser API** (`EXPO_PUBLIC_PARSER_API_URL` not set): Pasting a YouTube/Instagram URL and tapping **Get recipe** now shows a friendly title (e.g. "Recipe from YouTube") and **manual entry**: paste the recipe name and ingredients from the video description or caption into the form, then save.
- **With the parser API** (Vercel): Regular recipe websites with schema.org or lists may parse; YouTube/Instagram may still require manual entry. Either way, if ingredients can’t be extracted, the app shows the manual entry form so you can paste them in.
- **YouTube auto-extract:** Set **YOUTUBE_API_KEY** in Vercel (see 3.4). The API fetches the video title and description and parses **Ingredients** and **Instructions** from the description. Works best when the creator put those section headers in the video description.

### Why the API returns empty ingredients or a generic title

This happens when **none** of the YouTube-specific paths in the parser API return data, so the API falls back to fetching the YouTube **web page** HTML:

1. **YouTube Data API (description)** — If `YOUTUBE_API_KEY` is **not set in Vercel**, the API never fetches the video title/description. Set it (see 3.4) so the API can get the real video title and parse "Ingredients" / "Instructions" from the description.
2. **Transcript** — If the video has no captions (or transcript fetch fails), no ingredients are extracted from speech. The video must have captions (auto-generated or uploaded) for transcript-based extraction.
3. **Fallback HTML fetch** — When both above fail, the API fetches `youtube.com` with `fetch()`. YouTube’s initial HTML often has a `<title>` like `" - YouTube"` (the real title is loaded by JavaScript later), so the parser only sees "- YouTube". YouTube pages don’t contain recipe schema, so ingredients and steps stay empty.

**What to do:**

- **Set `YOUTUBE_API_KEY` in Vercel** (Settings → Environment Variables), then redeploy. You’ll get the real video title and, when the description has "Ingredients"/"Instructions", parsed ingredients and steps.
- **Transcript-only:** If you don’t use an API key, the API can still use the video transcript (via `multimodal AI (Gemini vision)`) if the video has captions. If you still get empty ingredients, that video may have no captions or transcript may be failing (check Vercel function logs).
- **Manual entry:** You can always paste the recipe name and ingredients in the app’s manual form and save.

---

## 5. How to test the app (step-by-step)

Use this checklist to verify setup and test the recipe parser (including cleaned ingredients) and optional Gemini vision.

### 5.1 Test the recipe parser API (cleaned ingredients from URLs)

This checks that the parse API runs and strips promo/social text, keeping only recipe and ingredients (e.g. “Recipe Ingredients” section).

1. **Deploy the API** (if you haven’t): Follow **section 3** to deploy `api/` to Vercel and set `EXPO_PUBLIC_PARSER_API_URL` in `.env`.
2. **Optional but recommended:** Set **YOUTUBE_API_KEY** in Vercel (section 3.4) so the API can fetch video title and description. Redeploy after adding the env var.
3. **Test with curl** (replace with your Vercel URL and a real YouTube recipe video ID):

```bash
curl "https://YOUR_VERCEL_URL/api/parse?url=https://www.youtube.com/watch?v=VIDEO_ID"
```

Example:

```bash
curl "https://recipe-cookbook-six.vercel.app/api/parse?url=https://www.youtube.com/watch?v=abc123"
```

4. **Check the response:** You should get JSON with `title`, `ingredients` (array), and `steps` (array). Ingredients should be **only** the real list (e.g. “Rice Flour - 2 Cup”, “salt - 1/4 tsp”) and **no** promo lines (subtitles, social links, “Dear friends”, Instagram/Facebook/Amazon/YouTube channel links). If the video description has a “Recipe Ingredients” section, the parser uses that and drops text before it.

### 5.1a Test YouTube video extraction + grocery by aisle

Checks that **Gemini analyzes the actual YouTube video** and returns ingredients plus **grocery list by supermarket aisle**.

**Prerequisites:** Parse API deployed to Vercel; **GEMINI_API_KEY** set in Vercel env; **EXPO_PUBLIC_PARSER_API_URL** in app `.env`.

**1. API test (curl)** – Replace `YOUR_VERCEL_URL` with your Vercel URL:

```bash
curl -s "https://YOUR_VERCEL_URL/api/parse?url=https://www.youtube.com/watch?v=Sd5SpMziJY4" | head -c 2000
```

**Check:** JSON has `title`, non-empty `ingredients`, and `groceryByAisle` (array of `{ "aisle": "Produce"|"Dairy"|... , "items": ["..."] }`). If `ingredients` is empty, confirm GEMINI_API_KEY in Vercel and redeploy; try another public YouTube recipe video; check Vercel Logs for errors.

**2. App test:** Paste screen → paste the same YouTube URL → tap **Get recipe**. You should see **Grocery list (by supermarket aisle)** with sections (Produce, Pantry, etc.) and items. Then **Save & Add to Grocery List** or **Save recipe only**.

**3. Pretty-print full response:** `curl -s "https://YOUR_VERCEL_URL/api/parse?url=https://www.youtube.com/watch?v=Sd5SpMziJY4" | python3 -m json.tool`

### 5.2 Test in the app (paste URL → get recipe)

1. **Start the app:**

```bash
npx expo start
```

2. Open the app in Expo Go (or simulator/emulator).
3. Sign in (or use anonymous auth if enabled).
4. Go to **Recipes** and tap **Paste recipe link** (or open the Paste screen from your nav).
5. Paste a **YouTube recipe URL** (or any URL your parser supports) and tap **Get recipe**.
6. **Expected:** The app shows the parsed title, ingredients list (cleaned, no promo/social lines), and steps. You can then **Save** or **Save and add to grocery list**.

If you see “Recipe from YouTube” with empty ingredients, either:
- Set **YOUTUBE_API_KEY** in Vercel and redeploy (so the API can read the description), or
- Use a video that has **captions** (the API can fall back to transcript), or
- Use **Paste from clipboard** and manually paste the ingredients.

### 5.3 Test Gemini (image → ingredients)

Only if you added a Gemini API key (section 3.6).

1. Ensure **`.env`** has `EXPO_PUBLIC_GEMINI_API_KEY=your-key` and restart Expo.
2. In the app, use the flow that sends a **photo or frame** to the vision API (e.g. camera or image picker for “ingredients from image”).
3. **Expected:** The app gets back a list of ingredients (with optional confidence) from Gemini and shows or merges them (e.g. into grocery list or recipe).

If you don’t have a vision flow in the UI yet, the key is still used by the vision service when that feature is triggered from the codebase.

### 5.4 Quick checklist

- [ ] **Supabase:** `.env` has `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`; migrations run; auth (Email/Anonymous) enabled.
- [ ] **Parser API:** `EXPO_PUBLIC_PARSER_API_URL` in `.env` points to your Vercel URL; optional `YOUTUBE_API_KEY` set in Vercel and redeployed.
- [ ] **Parse test:** `curl "YOUR_VERCEL_URL/api/parse?url=YOUTUBE_URL"` returns JSON with cleaned `ingredients` (no promo/social lines).
- [ ] **App test:** Paste a recipe URL in the app → Get recipe → see title + ingredients + steps; save or add to grocery list.
- [ ] **Gemini (optional):** `EXPO_PUBLIC_GEMINI_API_KEY` in `.env`; vision flow (if present) returns ingredients from an image.
