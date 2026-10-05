-- Diego OS · Fase 1: tareas, objetivos y recordatorios.
-- Pegar en Supabase → SQL Editor → Run (o `supabase db push`).
-- Cada fila pertenece a un usuario y RLS impide leer/escribir filas ajenas.

create type public.area as enum ('uni', 'salud', 'fin', 'trabajo', 'personal');

create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area        public.area not null,
  title       text not null check (length(trim(title)) > 0),
  meta        text,
  due_date    date,
  due_time    time,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);

create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area        public.area not null,
  title       text not null check (length(trim(title)) > 0),
  status      text,
  progress    numeric(5, 2) not null default 0 check (progress between 0 and 100),
  created_at  timestamptz not null default now()
);

create table public.reminders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area        public.area not null,
  title       text not null check (length(trim(title)) > 0),
  icon        text not null default 'ph ph-bell',
  remind_on   date not null,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index tasks_user_due_idx on public.tasks (user_id, due_date);
create index goals_user_idx on public.goals (user_id);
create index reminders_user_on_idx on public.reminders (user_id, remind_on);

alter table public.tasks enable row level security;
alter table public.goals enable row level security;
alter table public.reminders enable row level security;

create policy "tasks: dueño" on public.tasks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "goals: dueño" on public.goals
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "reminders: dueño" on public.reminders
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
