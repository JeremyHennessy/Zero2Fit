-- Zero2Fit Build 003 private-data foundation
-- Run in a Supabase project only after the project is provisioned.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'America/Moncton',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.device_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  family text not null,
  manufacturer text,
  model text,
  model_verified boolean not null default false,
  app_name text,
  transport text,
  status text not null default 'planned',
  last_import_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists device_connections_owner_identity_uidx
  on public.device_connections (user_id, family, coalesce(model, ''), coalesce(app_name, ''));

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_family text not null,
  transport text not null,
  source_filename text,
  source_checksum text,
  imported_at timestamptz not null default now(),
  record_count integer not null default 0,
  rejected_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, source_family, source_checksum)
);

create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null,
  metric text not null,
  value double precision,
  text_value text,
  unit text,
  observed_at timestamptz not null,
  quality text not null check (quality in ('observed','estimated','derived')),
  source_family text not null,
  source_app text,
  source_device text,
  transport text,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create index if not exists measurements_user_metric_time_idx
  on public.measurements (user_id, metric, observed_at desc);

create table if not exists public.device_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null,
  workout_type text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer,
  active_energy_kcal double precision,
  total_energy_kcal double precision,
  distance_meters double precision,
  source_family text not null,
  source_app text,
  source_device text,
  transport text,
  import_batch_id uuid references public.import_batches(id) on delete set null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create index if not exists device_workouts_user_time_idx
  on public.device_workouts (user_id, started_at desc);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_session_id text,
  plan_template_id text,
  plan_template_name text,
  location text,
  mode text,
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer,
  estimated_active_kcal double precision,
  estimated_gross_kcal double precision,
  device_workout_id uuid references public.device_workouts(id) on delete set null,
  completed_exercise_ids jsonb not null default '[]'::jsonb,
  unavailable_intents jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, local_session_id)
);

create table if not exists public.progress_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  fitness_level integer not null default 1,
  total_xp integer not null default 0,
  attributes jsonb not null default '{}'::jsonb,
  rpg_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.progress_photo_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  captured_at timestamptz not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.progress_photo_sessions(id) on delete cascade,
  view text not null check (view in ('front','left','right','back','other')),
  storage_provider text not null default 'supabase',
  object_key text not null,
  mime_type text,
  width integer,
  height integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, session_id, view)
);

alter table public.profiles enable row level security;
alter table public.device_connections enable row level security;
alter table public.import_batches enable row level security;
alter table public.measurements enable row level security;
alter table public.device_workouts enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.progress_state enable row level security;
alter table public.progress_photo_sessions enable row level security;
alter table public.progress_photos enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','device_connections','import_batches','measurements','device_workouts',
    'workout_sessions','progress_state','progress_photo_sessions','progress_photos'
  ] loop
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format(
      'create policy owner_all on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t
    );
  end loop;
end $$;

-- Storage bucket creation/policy is intentionally not embedded here because the
-- application may start with Supabase Storage and later move binaries to R2.
-- Keep all progress-photo buckets private; expose objects only through authenticated
-- storage policies or short-lived signed URLs.
