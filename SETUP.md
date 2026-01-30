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

Restart Expo after changing `.env`:

```bash
npx expo start
```

---

## 4. Add RevenueCat API keys when testing paywall on device/simulator

RevenueCat only works on **iOS** and **Android** builds (not in web). You need an app in App Store Connect and/or Google Play for production; for the contest you can use **sandbox** with API keys.

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
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_xxxxxxxxxxxx
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_xxxxxxxxxxxx
```

Use the **Public API keys** from RevenueCat (one per platform). Leave the Android one empty if you’re only testing on iOS.

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
- [ ] `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` (and Android if needed) set in `.env`
- [ ] Paywall tested on iOS/Android device or simulator with sandbox/test account

After any `.env` change, restart Expo: `npx expo start`.
