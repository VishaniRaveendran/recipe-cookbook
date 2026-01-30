-- Recipes
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_url text not null,
  title text not null,
  image_url text,
  ingredients text[] not null default '{}',
  steps text[] not null default '{}',
  created_at timestamptz not null default now(),
  cooked_at timestamptz
);

create index if not exists recipes_user_id on public.recipes(user_id);

-- Grocery lists
create table if not exists public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete set null,
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists grocery_lists_user_id on public.grocery_lists(user_id);

-- RLS
alter table public.recipes enable row level security;
alter table public.grocery_lists enable row level security;

create policy "Users can manage own recipes"
  on public.recipes for all
  using (auth.uid() = user_id);

create policy "Users can manage own grocery lists"
  on public.grocery_lists for all
  using (auth.uid() = user_id);
