-- Diego OS · Fase 2 (Salud): registro de creatina (una fila por día).

create table public.creatine (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  grams       numeric(5, 1) not null check (grams > 0),
  created_at  timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.creatine enable row level security;

create policy "creatine: dueño" on public.creatine
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
