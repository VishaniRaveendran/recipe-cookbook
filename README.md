# Recipe Cookbook (Shipyard Creator Contest MVP)

Mobile-first recipe organizer with smart grocery lists. Paste a recipe link → get a clean recipe and grouped grocery list → Cook Tonight.

## Stack

- **Frontend:** React Native (Expo) with Expo Router
- **Backend:** Supabase (Auth, Postgres)
- **Monetization:** RevenueCat (subscription)
- **Parser API:** Optional Vercel serverless in `api/parse.ts`

## Setup

1. **Clone and install**

   ```bash
   npm install
   ```

2. **Environment** — See **[SETUP.md](SETUP.md)** for step-by-step instructions:

   - Copy `.env.example` to `.env` and set Supabase URL + anon key
   - In Supabase: run `supabase/migrations/001_initial.sql`, enable Email (and optionally Anonymous) auth
   - Optionally deploy `api/` to Vercel and set `EXPO_PUBLIC_PARSER_API_URL`
   - Add RevenueCat API keys when testing paywall on device/simulator

3. **Run**
   ```bash
   npx expo start
   ```
   Then press `i` for iOS or `a` for Android.

## Features (MVP)

- **Save recipe via link** — Paste Instagram, YouTube, or website URL; auto-extract or add manually.
- **Smart grocery list** — Grouped by category (Produce, Dairy, Meat, Pantry, etc.); check off in-store.
- **Cook Tonight** — Pick one recipe → one tap → today’s grocery list.
- **Cooked it** — Mark recipe as cooked; small win.
- **RevenueCat subscription** — Free: 3 saved recipes, 1 Cook Tonight/week. Paid: unlimited.

## Project structure

- `app/` — Expo Router screens (onboarding, tabs, recipe detail, paste/paywall/sign-in modals).
- `context/` — Auth (Supabase), Subscription (RevenueCat).
- `hooks/` — useRecipes, useGroceryList (Supabase).
- `lib/` — Supabase client, recipe parser, grocery categories.
- `api/` — Optional Vercel serverless for URL → recipe parsing.

## Open source & free options

**Open source packages in this project**

- [Expo](https://github.com/expo/expo) (BSD) — React Native tooling and runtime
- [React Native](https://github.com/facebook/react-native) (MIT)
- [Supabase JS](https://github.com/supabase/supabase-js) (MIT) — Auth + Postgres client
- [React Navigation](https://github.com/react-navigation/react-navigation) (MIT)
- [Expo Router](https://github.com/expo/expo-router) (MIT)
- [react-native-purchases](https://github.com/RevenueCat/react-native-purchases) (MIT) — RevenueCat SDK (free to use; RevenueCat charges on revenue)

**Free / open services you can use**

- **Supabase** — Free tier (auth, Postgres, storage); [open source](https://github.com/supabase/supabase) self-host option
- **Vercel** — Free tier for serverless (parser API)
- **YouTube Data API v3** — Free quota (e.g. 10,000 units/day); 1 unit per video request
- **RevenueCat** — Free tier; pay only on successful subscription revenue

**Other open source options (not used here)**

- **Auth:** [Supabase Auth](https://supabase.com/docs/guides/auth) (used), [Firebase Auth](https://firebase.google.com/docs/auth), [Clerk](https://clerk.com)
- **DB:** Supabase (Postgres), [PocketBase](https://pocketbase.io/) (single binary, SQLite)
- **Subscriptions:** RevenueCat (contest requirement); alternatives include [Adapty](https://adapty.io/), or native StoreKit/Play Billing with your own backend
- **Recipe parsing:** Custom logic in `api/parse.ts`; no third-party recipe API required. For scraping, [Mozilla Readability](https://github.com/mozilla/readability) or similar could be added server-side.

## Contest alignment

- **Audience Fit:** Eitan’s “save but don’t cook” problem → one flow from link to list to cook.
- **UX:** 30–45s onboarding, no account first; one primary flow; warm, food-forward tone.
- **Monetization:** RevenueCat paywall after first Cook Tonight or at 3 recipes.
- **Innovation:** “Cook Tonight” + “Cooked it” close the loop from saved → cooked.
