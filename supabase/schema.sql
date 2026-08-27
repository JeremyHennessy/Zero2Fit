-- Zero2Fit Build 003 target Supabase schema.
-- This prepares a future private project. No URL, service-role key or private credential belongs in this repository.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_units jsonb not null default '{}'::jsonb,
  workout_location text not null default 'home',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.device_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id text not null,
  provider text not null,
  device_name text,
  status text not null default 'planned',
  last_sync_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, connection_id)
);

create table if not exists public.normalized_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  metric_type text not null,
  numeric_value double precision,
  text_value text,
  unit text not null,
  observed_at timestamptz not null,
  end_at timestamptz,
  source_provider text not null,
  source_device text,
  source_record_id text,
  imported_at timestamptz not null default now(),
  provenance_status text not null check (provenance_status in ('observed','imported','derived','user-entered')),
  confidence text not null,
  metadata jsonb not null default '{}'::jsonb,
  primary key (user_id, event_id),
  check (numeric_value is not null or text_value is not null)
);

create index if not exists normalized_events_user_observed_idx on public.normalized_events (user_id, observed_at desc);
create index if not exists normalized_events_user_metric_idx on public.normalized_events (user_id, metric_type, observed_at desc);
create index if not exists normalized_events_user_source_idx on public.normalized_events (user_id, source_provider, observed_at desc);

create table if not exists public.import_runs (
  user_id uuid not null references auth.users(id) on delete cascade,
  import_id text not null,
  source_provider text not null,
  imported_at timestamptz not null default now(),
  file_name text,
  file_size bigint,
  event_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  primary key (user_id, import_id)
);

create table if not exists public.workout_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null default gen_random_uuid(),
  template_id text,
  workout_name text not null,
  mode text,
  location text,
  started_at timestamptz,
  completed_at timestamptz,
  completion_fraction double precision,
  source_provider text not null default 'zero2fit',
  source_record_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, session_id)
);

create table if not exists public.workout_sets (
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id uuid not null default gen_random_uuid(),
  session_id uuid not null,
  exercise_id text not null,
  set_number integer not null,
  reps double precision,
  load_value double precision,
  load_unit text,
  completed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  primary key (user_id, set_id),
  foreign key (user_id, session_id) references public.workout_sessions(user_id, session_id) on delete cascade
);

create table if not exists public.fitness_xp_ledger (
  user_id uuid not null references auth.users(id) on delete cascade,
  ledger_id uuid not null default gen_random_uuid(),
  xp_amount integer not null,
  attribute text,
  reason text not null,
  source_event_id text,
  unique_award_key text,
  awarded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (user_id, ledger_id),
  unique (user_id, unique_award_key)
);

create table if not exists public.rpg_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_xp bigint not null default 0,
  fitness_level integer not null default 1,
  attributes jsonb not null default '{}'::jsonb,
  character_state jsonb not null default '{}'::jsonb,
  adventure_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.progress_photo_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null default gen_random_uuid(),
  captured_at timestamptz not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, session_id)
);

create table if not exists public.progress_photo_assets (
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_id uuid not null default gen_random_uuid(),
  session_id uuid not null,
  view text not null check (view in ('front','left','right','back','other')),
  storage_path text not null,
  mime_type text,
  width integer,
  height integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, photo_id),
  foreign key (user_id, session_id) references public.progress_photo_sessions(user_id, session_id) on delete cascade
);

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.device_connections enable row level security;
alter table public.normalized_events enable row level security;
alter table public.import_runs enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_sets enable row level security;
alter table public.fitness_xp_ledger enable row level security;
alter table public.rpg_state enable row level security;
alter table public.progress_photo_sessions enable row level security;
alter table public.progress_photo_assets enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles','user_preferences','device_connections','normalized_events','import_runs','workout_sessions',
    'workout_sets','fitness_xp_ledger','rpg_state','progress_photo_sessions','progress_photo_assets'
  ]
  loop
    execute format('drop policy if exists "own rows select" on public.%I', table_name);
    execute format('drop policy if exists "own rows insert" on public.%I', table_name);
    execute format('drop policy if exists "own rows update" on public.%I', table_name);
    execute format('drop policy if exists "own rows delete" on public.%I', table_name);
    execute format('create policy "own rows select" on public.%I for select using (auth.uid() = user_id)', table_name);
    execute format('create policy "own rows insert" on public.%I for insert with check (auth.uid() = user_id)', table_name);
    execute format('create policy "own rows update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name);
    execute format('create policy "own rows delete" on public.%I for delete using (auth.uid() = user_id)', table_name);
  end loop;
end $$;

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "own progress photos select" on storage.objects;
drop policy if exists "own progress photos insert" on storage.objects;
drop policy if exists "own progress photos update" on storage.objects;
drop policy if exists "own progress photos delete" on storage.objects;

create policy "own progress photos select" on storage.objects for select using (
  bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "own progress photos insert" on storage.objects for insert with check (
  bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "own progress photos update" on storage.objects for update using (
  bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "own progress photos delete" on storage.objects for delete using (
  bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text
);

-- Browser rule: only a public anon key may be used client-side, and only with authenticated RLS.
-- Never place a Supabase service-role key in GitHub Pages, repository files or client JavaScript.
