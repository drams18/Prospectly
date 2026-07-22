-- Big CRM overhaul: timestamped/append-only notes, multi-reminder support
-- with push notifications, and a persistent Explorer prospecting session.
--
-- `prospects.notes` (scalar, overwritten on every save) and
-- `prospects.reminder_at` (single-slot placeholder from 0003, never wired
-- up by any UI/service) are dropped in favor of the dedicated tables below
-- — no code anywhere reads `notes` for search/filtering, so this is a clean
-- cut rather than a partial migration.

-- ─── drop superseded columns ────────────────────────────────────────────────

alter table public.prospects drop column if exists notes;
alter table public.prospects drop column if exists reminder_at;

-- ─── prospect_notes: append-only, timestamped, never overwritten ──────────

create table if not exists public.prospect_notes (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_prospect_notes_prospect
  on public.prospect_notes (prospect_id, created_at desc);

alter table public.prospect_notes enable row level security;

drop policy if exists "prospect_notes_select_own" on public.prospect_notes;
create policy "prospect_notes_select_own" on public.prospect_notes
  for select using (auth.uid() = user_id);
drop policy if exists "prospect_notes_insert_own" on public.prospect_notes;
create policy "prospect_notes_insert_own" on public.prospect_notes
  for insert with check (auth.uid() = user_id);
-- Deliberately no update/delete policy: notes are permanent once written.

-- ─── reminders: 0, 1 or many per prospect ──────────────────────────────────

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  remind_at timestamptz not null,
  title text not null default '',
  comment text,
  -- Channel-agnostic from day one so email/sms/whatsapp/task reminders can
  -- be added later without a schema change (point 14).
  type text not null default 'call' check (type in ('call','email','sms','whatsapp','task')),
  status text not null default 'pending' check (status in ('pending','done')),
  -- Set once a push has actually been sent for this occurrence; cleared by
  -- "reporter" (snooze) so the new remind_at can fire its own notification.
  notified_at timestamptz,
  completed_at timestamptz,
  -- Nullable placeholders for future Google/Apple Calendar sync (point 14).
  external_calendar_provider text,
  external_calendar_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reminders_user_remind_at
  on public.reminders (user_id, remind_at);
create index if not exists idx_reminders_prospect
  on public.reminders (prospect_id, remind_at desc);

alter table public.reminders enable row level security;

drop policy if exists "reminders_select_own" on public.reminders;
create policy "reminders_select_own" on public.reminders
  for select using (auth.uid() = user_id);
drop policy if exists "reminders_insert_own" on public.reminders;
create policy "reminders_insert_own" on public.reminders
  for insert with check (auth.uid() = user_id);
drop policy if exists "reminders_update_own" on public.reminders;
create policy "reminders_update_own" on public.reminders
  for update using (auth.uid() = user_id);
drop policy if exists "reminders_delete_own" on public.reminders;
create policy "reminders_delete_own" on public.reminders
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

drop trigger if exists trg_reminders_updated_at on public.reminders;
create trigger trg_reminders_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();

-- ─── push_subscriptions: one row per device/browser endpoint ───────────────

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own" on public.push_subscriptions
  for select using (auth.uid() = user_id);
drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- ─── prospecting_sessions: exact Explorer feed state, survives reload ──────

create table if not exists public.prospecting_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed')),
  coords jsonb,
  category_ids text[] not null default '{}',
  -- Full lead snapshots (not just place_ids): resuming must never re-hit
  -- the Google Places API or risk a different order/content on refetch.
  leads jsonb not null default '[]',
  current_index int not null default 0,
  -- Next `fetchFeedBand` bandIndex to request when the stored leads run
  -- out — keeps pagination continuous across a resumed session instead of
  -- re-fetching (and re-filtering) bands already folded into `leads`.
  next_band_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only one active session per user at a time.
create unique index if not exists idx_prospecting_sessions_active_user
  on public.prospecting_sessions (user_id) where (status = 'active');

alter table public.prospecting_sessions enable row level security;

drop policy if exists "prospecting_sessions_select_own" on public.prospecting_sessions;
create policy "prospecting_sessions_select_own" on public.prospecting_sessions
  for select using (auth.uid() = user_id);
drop policy if exists "prospecting_sessions_insert_own" on public.prospecting_sessions;
create policy "prospecting_sessions_insert_own" on public.prospecting_sessions
  for insert with check (auth.uid() = user_id);
drop policy if exists "prospecting_sessions_update_own" on public.prospecting_sessions;
create policy "prospecting_sessions_update_own" on public.prospecting_sessions
  for update using (auth.uid() = user_id);
drop policy if exists "prospecting_sessions_delete_own" on public.prospecting_sessions;
create policy "prospecting_sessions_delete_own" on public.prospecting_sessions
  for delete using (auth.uid() = user_id);

drop trigger if exists trg_prospecting_sessions_updated_at on public.prospecting_sessions;
create trigger trg_prospecting_sessions_updated_at
  before update on public.prospecting_sessions
  for each row execute function public.set_updated_at();

-- ─── audit log: drop the notes branch, add priority + notes/reminders ─────

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
    if new.is_favorite is distinct from old.is_favorite then
      insert into public.prospect_history (prospect_id, user_id, action, old_value, new_value)
      values (new.id, new.user_id, 'favorite_toggled', old.is_favorite::text, new.is_favorite::text);
    end if;
    if new.priority is distinct from old.priority then
      insert into public.prospect_history (prospect_id, user_id, action, old_value, new_value)
      values (new.id, new.user_id, 'priority_changed', old.priority, new.priority);
    end if;
    if new.is_seen is distinct from old.is_seen then
      insert into public.prospect_history (prospect_id, user_id, action, old_value, new_value)
      values (new.id, new.user_id, case when new.is_seen then 'reseen' else 'restored_to_feed' end, old.is_seen::text, new.is_seen::text);
    end if;
    return new;
  end if;

  return new;
end;
$$;

create or replace function public.log_note_added()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.prospect_history (prospect_id, user_id, action, old_value, new_value)
  values (new.prospect_id, new.user_id, 'note_added', null, new.content);
  return new;
end;
$$;

drop trigger if exists trg_prospect_notes_log_insert on public.prospect_notes;
create trigger trg_prospect_notes_log_insert
  after insert on public.prospect_notes
  for each row execute function public.log_note_added();

create or replace function public.log_reminder_changes()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.prospect_history (prospect_id, user_id, action, old_value, new_value)
    values (new.prospect_id, new.user_id, 'reminder_created', null, new.remind_at::text);
    return new;
  end if;

  if (tg_op = 'UPDATE') then
    if new.status is distinct from old.status and new.status = 'done' then
      insert into public.prospect_history (prospect_id, user_id, action, old_value, new_value)
      values (new.prospect_id, new.user_id, 'reminder_completed', old.remind_at::text, new.remind_at::text);
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reminders_log_insert on public.reminders;
create trigger trg_reminders_log_insert
  after insert on public.reminders
  for each row execute function public.log_reminder_changes();

drop trigger if exists trg_reminders_log_update on public.reminders;
create trigger trg_reminders_log_update
  after update on public.reminders
  for each row execute function public.log_reminder_changes();
