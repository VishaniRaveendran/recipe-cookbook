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

1. **Root Directory** — In Vercel → Project → **Settings** → **General**, set **Root Directory** to the repo root (or leave empty). If it points to a subfolder (e.g. `app`), the `api/` folder at the root won’t be deployed.
2. **Commit and redeploy** — Ensure `api/parse.ts` and `vercel.json` are committed. Redeploy (Vercel → Deployments → ⋮ on latest → Redeploy).
3. **`vercel.json`** — The repo includes a `vercel.json` that registers `api/parse.ts` as a serverless function; keep it so `/api/parse` is served.

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

### 3.5 YouTube video transcript (ingredients from speech)

The parser API can also **analyse the video’s captions/transcript** to extract ingredients from what the host says (e.g. “we need two cups of flour”). No API key is required for this.

- **How it works:** When you paste a YouTube URL and call the parser API, it (1) tries **description** first (with `YOUTUBE_API_KEY` if set) for title, thumbnail, and written ingredients; (2) if the description has few or no ingredients, it fetches the **video transcript** using the `youtube-transcript` package (public captions); (3) it parses the transcript for ingredient-like phrases and merges them with description ingredients.
- **Transcript-only:** If you don’t set `YOUTUBE_API_KEY`, the API can still use **transcript only**: it fetches captions and extracts ingredients from the spoken text. You get “Recipe from YouTube” and a list of ingredients from the transcript.
- **Requirement:** The video must have **captions** (auto-generated or uploaded). If captions are disabled, only description (with API key) or manual entry in the app will work.

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
