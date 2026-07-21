-- Separate "Historique" (everything ever seen in the feed) from "Mes
-- Prospects" (only what the user explicitly validated). Until now every
-- card shown in the swipe feed was upserted into `prospects` the same way
-- whether the user tapped "Sauvegarder" or just skipped it (✕), so the two
-- pages showed the same rows.
--
-- is_validated=true is set only by the explicit save/validate action
-- (services/prospects.ts saveLead). Passively viewing a card (skip, or
-- just letting it pass) keeps is_validated=false. Historique keeps showing
-- every seen row regardless; "Mes Prospects" now filters on is_validated.
--
-- Existing rows are backfilled to is_validated=true so nothing disappears
-- from "Mes Prospects" for prospects the user already processed pre-migration.

alter table public.prospects add column if not exists is_validated boolean not null default false;
update public.prospects set is_validated = true;

create index if not exists idx_prospects_user_validated
  on public.prospects (user_id, is_validated);
