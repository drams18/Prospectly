-- Category filters (point 13): store the user's last-used feed category
-- selection so it's remembered across devices/sessions. A single array
-- column on `profiles` is enough — there's only ever one "last used" filter
-- per user, no history needed.

alter table public.profiles
  add column if not exists category_filters text[] not null default '{}';
