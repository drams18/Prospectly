-- Prospectly — Supabase schema
-- Unified prospect CRM: profiles, prospects, prospect_history, search_history, search_cache.

create extension if not exists pg_trgm;

-- ─── profiles ───────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  start_address text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Auto-create a profile row on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── prospects ──────────────────────────────────────────────────────────────

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text,
  name text not null,
  category text,
  phone text,
  website text,
  email text,
  address text,
  city text,
  country text default 'France',
  lat double precision,
  lng double precision,
  status text not null default 'new'
    check (status in ('new','seen','contacted','appointment','client','refused','follow_up')),
  score integer,
  rating real,
  reviews integer,
  google_maps_url text,
  has_booking boolean,
  booking_type text,
  has_instagram boolean,
  is_hot boolean,
  wasted_potential boolean,
  is_favorite boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_prospects_user_place
  on public.prospects (user_id, place_id) where place_id is not null;

create index if not exists idx_prospects_user_status
  on public.prospects (user_id, status);

create index if not exists idx_prospects_user_favorite
  on public.prospects (user_id, is_favorite);

create index if not exists idx_prospects_name_trgm
  on public.prospects using gin (name gin_trgm_ops);
create index if not exists idx_prospects_address_trgm
  on public.prospects using gin (address gin_trgm_ops);
create index if not exists idx_prospects_phone_trgm
  on public.prospects using gin (phone gin_trgm_ops);
create index if not exists idx_prospects_website_trgm
  on public.prospects using gin (website gin_trgm_ops);
create index if not exists idx_prospects_category_trgm
  on public.prospects using gin (category gin_trgm_ops);

alter table public.prospects enable row level security;

create policy "prospects_select_own" on public.prospects
  for select using (auth.uid() = user_id);
create policy "prospects_insert_own" on public.prospects
  for insert with check (auth.uid() = user_id);
create policy "prospects_update_own" on public.prospects
  for update using (auth.uid() = user_id);
create policy "prospects_delete_own" on public.prospects
  for delete using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_prospects_updated_at on public.prospects;
create trigger trg_prospects_updated_at
  before update on public.prospects
  for each row execute function public.set_updated_at();

-- ─── prospect_history ───────────────────────────────────────────────────────

create table if not exists public.prospect_history (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create index if not exists idx_prospect_history_prospect
  on public.prospect_history (prospect_id, created_at desc);
create index if not exists idx_prospect_history_user
  on public.prospect_history (user_id);

alter table public.prospect_history enable row level security;

create policy "prospect_history_select_own" on public.prospect_history
  for select using (auth.uid() = user_id);
create policy "prospect_history_insert_own" on public.prospect_history
  for insert with check (auth.uid() = user_id);

-- Auto-historize every create/status/notes/favorite change — the client never
-- has to remember to log an action; every write path (including future ones)
-- is covered for free.
create or replace function public.log_prospect_changes()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.prospect_history (prospect_id, user_id, action, old_value, new_value)
    values (new.id, new.user_id, 'created', null, new.status);
    return new;
  end if;

  if (tg_op = 'UPDATE') then
    if new.status is distinct from old.status then
      insert into public.prospect_history (prospect_id, user_id, action, old_value, new_value)
      values (new.id, new.user_id, 'status_change', old.status, new.status);
    end if;
    if new.notes is distinct from old.notes then
      insert into public.prospect_history (prospect_id, user_id, action, old_value, new_value)
      values (new.id, new.user_id, 'note_updated', old.notes, new.notes);
    end if;
    if new.is_favorite is distinct from old.is_favorite then
      insert into public.prospect_history (prospect_id, user_id, action, old_value, new_value)
      values (new.id, new.user_id, 'favorite_toggled', old.is_favorite::text, new.is_favorite::text);
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prospects_log_insert on public.prospects;
create trigger trg_prospects_log_insert
  after insert on public.prospects
  for each row execute function public.log_prospect_changes();

drop trigger if exists trg_prospects_log_update on public.prospects;
create trigger trg_prospects_log_update
  after update on public.prospects
  for each row execute function public.log_prospect_changes();

-- ─── search_history ─────────────────────────────────────────────────────────

create table if not exists public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  location text not null,
  searched_at timestamptz not null default now()
);

create index if not exists idx_search_history_user
  on public.search_history (user_id, searched_at desc);

alter table public.search_history enable row level security;

create policy "search_history_select_own" on public.search_history
  for select using (auth.uid() = user_id);
create policy "search_history_insert_own" on public.search_history
  for insert with check (auth.uid() = user_id);
create policy "search_history_delete_own" on public.search_history
  for delete using (auth.uid() = user_id);

-- ─── search_cache ───────────────────────────────────────────────────────────
-- Server-side only (Edge Function via service-role key). RLS enabled with no
-- policies at all -> unreachable from anon/authenticated clients.

create table if not exists public.search_cache (
  key text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.search_cache enable row level security;
