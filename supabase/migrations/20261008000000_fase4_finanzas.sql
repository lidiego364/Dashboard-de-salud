-- Diego OS · Fase 4 (Finanzas): movimientos importados (CSV/PDF de Wells Fargo)
-- o anotados a mano, correcciones de categoría por comercio y ajustes.

create table public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date         date not null,
  amount       numeric(12, 2) not null, -- < 0 gasto, > 0 ingreso
  description  text not null,
  merchant     text not null,
  category     text not null,
  source       text not null check (source in ('csv', 'pdf', 'manual')),
  hash         text not null,
  created_at   timestamptz not null default now(),
  unique (user_id, hash)
);

create table public.fin_rules (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  merchant_key  text not null,
  category      text not null,
  created_at    timestamptz not null default now(),
  unique (user_id, merchant_key)
);

create table public.settings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key         text not null,
  value       numeric not null,
  created_at  timestamptz not null default now(),
  unique (user_id, key)
);

create index transactions_user_date_idx on public.transactions (user_id, date);

alter table public.transactions enable row level security;
alter table public.fin_rules enable row level security;
alter table public.settings enable row level security;

create policy "transactions: dueño" on public.transactions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "fin_rules: dueño" on public.fin_rules for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "settings: dueño" on public.settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
