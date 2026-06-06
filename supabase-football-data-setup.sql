-- Kjor denne i Supabase SQL Editor for football-data.org-integrasjonen.

alter table public.matches
  add column if not exists home_crest text,
  add column if not exists away_crest text,
  add column if not exists last_synced_at timestamptz;

update public.profiles
set is_admin = true
where email = 'olejoergen@gmail.com';
