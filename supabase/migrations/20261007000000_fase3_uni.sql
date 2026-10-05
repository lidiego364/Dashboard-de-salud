-- Diego OS · Fase 3 (Universidad): cursos (del syllabus) y datos propios de
-- cada entrega (hecha, checklist, tiempo estimado).

create table public.courses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code           text not null,
  name           text not null,
  calendar_name  text,
  -- [{ "name": "Quizzes", "weight_pct": 20, "count": 10, "keywords": ["quiz"] }, …]
  components     jsonb not null default '[]'::jsonb check (jsonb_typeof(components) = 'array'),
  grade          text,
  created_at     timestamptz not null default now()
);

create table public.assignment_meta (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key         text not null, -- "cal:<id de Google>" o "task:<id>"
  done_at     timestamptz,
  checklist   jsonb check (checklist is null or jsonb_typeof(checklist) = 'array'),
  minutes     integer check (minutes is null or minutes > 0),
  created_at  timestamptz not null default now(),
  unique (user_id, key)
);

alter table public.courses enable row level security;
alter table public.assignment_meta enable row level security;

create policy "courses: dueño" on public.courses
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "assignment_meta: dueño" on public.assignment_meta
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
