-- Restore the CRM depth that 0002_simplify.sql stripped out, plus the
-- "never re-show a seen prospect" tracking + Historique page requirements:
--   - full 7-status pipeline
--   - is_seen / first_seen_at / last_seen_at so the feed can permanently
--     exclude anything already displayed, and a prospect can be restored
--   - photos / opening_hours captured at view time (only source is the
--     Places API response, which the Historique page can no longer refetch)
--   - reminder_at / priority / tags: forward-looking CRM columns (rappels,
--     relance, priorité, tags) so those features don't need a schema change
--   - prospect_history audit log, generic enough to later carry call/email
--     history via new `action` values

-- ─── status pipeline ────────────────────────────────────────────────────────

alter table public.prospects drop constraint prospects_status_check;
alter table public.prospects add constraint prospects_status_check
  check (status in ('to_contact','contacted','waiting','follow_up','client','refused','ignored'));

-- ─── seen tracking ──────────────────────────────────────────────────────────

alter table public.prospects add column if not exists is_seen boolean not null default true;
alter table public.prospects add column if not exists first_seen_at timestamptz not null default now();
alter table public.prospects add column if not exists last_seen_at timestamptz not null default now();

update public.prospects set first_seen_at = created_at, last_seen_at = updated_at;

create index if not exists idx_prospects_user_seen
  on public.prospects (user_id, is_seen);
create index if not exists idx_prospects_user_last_seen
  on public.prospects (user_id, last_seen_at desc);

-- ─── data captured at view time (feed leaves no other trace of these) ──────

alter table public.prospects add column if not exists photos text[];
alter table public.prospects add column if not exists opening_hours jsonb;

-- ─── forward-looking CRM columns ────────────────────────────────────────────

alter table public.prospects add column if not exists reminder_at timestamptz;
alter table public.prospects add column if not exists priority text
  check (priority in ('low','medium','high'));
alter table public.prospects add column if not exists tags text[] not null default '{}';

-- ─── prospect_history (restored from 0001, dropped by 0002) ────────────────

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

drop policy if exists "prospect_history_select_own" on public.prospect_history;
create policy "prospect_history_select_own" on public.prospect_history
  for select using (auth.uid() = user_id);
drop policy if exists "prospect_history_insert_own" on public.prospect_history;
create policy "prospect_history_insert_own" on public.prospect_history
  for insert with check (auth.uid() = user_id);

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
    if new.is_seen is distinct from old.is_seen then
      insert into public.prospect_history (prospect_id, user_id, action, old_value, new_value)
      values (new.id, new.user_id, case when new.is_seen then 'reseen' else 'restored_to_feed' end, old.is_seen::text, new.is_seen::text);
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
