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

## Contest alignment

- **Audience Fit:** Eitan’s “save but don’t cook” problem → one flow from link to list to cook.
- **UX:** 30–45s onboarding, no account first; one primary flow; warm, food-forward tone.
- **Monetization:** RevenueCat paywall after first Cook Tonight or at 3 recipes.
- **Innovation:** “Cook Tonight” + “Cooked it” close the loop from saved → cooked.
