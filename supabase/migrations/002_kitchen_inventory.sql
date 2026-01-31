-- Kitchen inventory (fridge / pantry) for "what can I make" matching
create table if not exists public.kitchen_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create unique index if not exists kitchen_inventory_user_id on public.kitchen_inventory(user_id);

alter table public.kitchen_inventory enable row level security;

create policy "Users can manage own kitchen inventory"
  on public.kitchen_inventory for all
  using (auth.uid() = user_id);
