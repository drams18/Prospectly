-- Simplify prospects to a 3-status pipeline (to_contact/contacted/client) and
-- drop the prospect_history audit trail — no longer surfaced in the UI.

update public.prospects set status = case status
  when 'new' then 'to_contact'
  when 'seen' then 'to_contact'
  when 'refused' then 'to_contact'
  when 'appointment' then 'contacted'
  when 'follow_up' then 'contacted'
  else status
end;

alter table public.prospects drop constraint prospects_status_check;
alter table public.prospects add constraint prospects_status_check
  check (status in ('to_contact','contacted','client'));
alter table public.prospects alter column status set default 'to_contact';

drop trigger if exists trg_prospects_log_insert on public.prospects;
drop trigger if exists trg_prospects_log_update on public.prospects;
drop function if exists public.log_prospect_changes();
drop table if exists public.prospect_history cascade;
