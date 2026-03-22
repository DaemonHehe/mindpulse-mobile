-- Canonical MindPulse schema
-- Uses public.users as the single app profile table.
-- Legacy public.profiles is not part of the current schema.
--
-- Important:
-- If your existing public.users table was copied from auth.users
-- (for example it has columns like password_hash or role), this file will
-- not fully repair that shape because create table if not exists is
-- non-destructive. In that case, reset the app tables first, then rerun.
--
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Preflight:
-- If public.users was previously copied from auth.users, it can contain
-- auth-only columns such as password_hash with NOT NULL constraints.
-- This schema is non-destructive and cannot safely reshape that table.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'password_hash'
  ) then
    raise exception
      'public.users has legacy auth columns (password_hash detected). Run supabase/reset_schema.sql, then rerun supabase/schema.sql.';
  end if;
end;
$$;

-- ============================================
-- 1. USERS TABLE - Core identity and baselines
-- ============================================
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email varchar(255) unique,
  full_name text,
  created_at timestamptz not null default now(),
  baseline_hr_bpm integer,
  baseline_temp_c decimal(4,2),
  updated_at timestamptz not null default now()
);

alter table public.users add column if not exists email varchar(255);
alter table public.users add column if not exists full_name text;
alter table public.users add column if not exists created_at timestamptz not null default now();
alter table public.users add column if not exists baseline_hr_bpm integer;
alter table public.users add column if not exists baseline_temp_c decimal(4,2);
alter table public.users add column if not exists updated_at timestamptz not null default now();

-- RLS policies for users
alter table public.users enable row level security;

drop policy if exists "Users can view own data" on public.users;
create policy "Users can view own data"
  on public.users
  for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own data" on public.users;
create policy "Users can insert own data"
  on public.users
  for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own data" on public.users;
create policy "Users can update own data"
  on public.users
  for update
  using (auth.uid() = id);

drop policy if exists "Users can delete own data" on public.users;
create policy "Users can delete own data"
  on public.users
  for delete
  using (auth.uid() = id);

-- ============================================
-- 2. USER_SETTINGS TABLE - Lightweight settings
-- ============================================
create table if not exists public.user_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  push_notifications boolean not null default true,
  breathing_duration integer not null default 60,
  haptic_feedback boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings add column if not exists push_notifications boolean not null default true;
alter table public.user_settings add column if not exists breathing_duration integer not null default 60;
alter table public.user_settings add column if not exists haptic_feedback boolean not null default true;
alter table public.user_settings add column if not exists created_at timestamptz not null default now();
alter table public.user_settings add column if not exists updated_at timestamptz not null default now();

alter table public.user_settings enable row level security;

drop policy if exists "Users can view own settings" on public.user_settings;
create policy "Users can view own settings"
  on public.user_settings
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own settings" on public.user_settings;
create policy "Users can insert own settings"
  on public.user_settings
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings"
  on public.user_settings
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own settings" on public.user_settings;
create policy "Users can delete own settings"
  on public.user_settings
  for delete
  using (auth.uid() = user_id);

-- ============================================
-- 3. BIOMETRIC_WINDOWS TABLE - 1-minute aggregations
-- ============================================
create table if not exists public.biometric_windows (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  timestamp timestamptz not null,
  hr_mean decimal(5,2) not null,
  hrv_sdnn decimal(6,2) not null,
  temp_mean decimal(4,2) not null,
  eda_peaks integer not null,
  created_at timestamptz not null default now()
);

drop index if exists idx_biometric_windows_user_id;
create index idx_biometric_windows_user_id on public.biometric_windows(user_id);

drop index if exists idx_biometric_windows_timestamp;
create index idx_biometric_windows_timestamp on public.biometric_windows(timestamp);

drop index if exists idx_biometric_windows_user_timestamp;
create index idx_biometric_windows_user_timestamp
  on public.biometric_windows(user_id, timestamp desc);

alter table public.biometric_windows enable row level security;

drop policy if exists "Users can view own biometric data" on public.biometric_windows;
create policy "Users can view own biometric data"
  on public.biometric_windows
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own biometric data" on public.biometric_windows;
create policy "Users can insert own biometric data"
  on public.biometric_windows
  for insert
  with check (auth.uid() = user_id);

-- ============================================
-- 4. PREDICTIONS_LOG TABLE - ML output analytics
-- ============================================
create table if not exists public.predictions_log (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  window_id bigint not null references public.biometric_windows(id) on delete cascade,
  rf_confidence decimal(3,2) not null,
  lstm_confidence decimal(3,2) not null,
  fused_score decimal(3,2) not null,
  final_state varchar(20) not null check (final_state in ('Stressed', 'Relaxed')),
  created_at timestamptz not null default now()
);

drop index if exists idx_predictions_user_id;
create index idx_predictions_user_id on public.predictions_log(user_id);

drop index if exists idx_predictions_window_id;
create index idx_predictions_window_id on public.predictions_log(window_id);

drop index if exists idx_predictions_created_at;
create index idx_predictions_created_at on public.predictions_log(created_at desc);

alter table public.predictions_log enable row level security;

drop policy if exists "Users can view own predictions" on public.predictions_log;
create policy "Users can view own predictions"
  on public.predictions_log
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own predictions" on public.predictions_log;
create policy "Users can insert own predictions"
  on public.predictions_log
  for insert
  with check (auth.uid() = user_id);

-- ============================================
-- 5. INTERVENTIONS TABLE - Breathing exercise events
-- ============================================
create table if not exists public.interventions (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  prediction_id bigint references public.predictions_log(id) on delete set null,
  started_at timestamptz not null,
  completed_secs integer not null,
  trigger_type varchar(20) not null check (trigger_type in ('Automatic', 'Manual')),
  user_feedback varchar(20) check (user_feedback in ('Better', 'Same', 'Worse')),
  created_at timestamptz not null default now()
);

drop index if exists idx_interventions_user_id;
create index idx_interventions_user_id on public.interventions(user_id);

drop index if exists idx_interventions_prediction_id;
create index idx_interventions_prediction_id on public.interventions(prediction_id);

drop index if exists idx_interventions_started_at;
create index idx_interventions_started_at on public.interventions(started_at desc);

alter table public.interventions enable row level security;

drop policy if exists "Users can view own interventions" on public.interventions;
create policy "Users can view own interventions"
  on public.interventions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own interventions" on public.interventions;
create policy "Users can insert own interventions"
  on public.interventions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own interventions" on public.interventions;
create policy "Users can update own interventions"
  on public.interventions
  for update
  using (auth.uid() = user_id);

-- ============================================
-- AUTH SYNC - Seed public tables from auth.users
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.users.full_name);

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- UTILITY: Updated timestamp trigger function
-- ============================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ============================================
-- BACKFILL - Existing auth users into app tables
-- ============================================
insert into public.users (id, email, full_name)
select
  au.id,
  au.email,
  nullif(au.raw_user_meta_data ->> 'full_name', '')
from auth.users au
on conflict (id) do update
set
  email = excluded.email,
  full_name = coalesce(excluded.full_name, public.users.full_name);

insert into public.user_settings (user_id)
select au.id
from auth.users au
on conflict (user_id) do nothing;
