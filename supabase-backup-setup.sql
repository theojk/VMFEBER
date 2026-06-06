-- Kjor denne i Supabase SQL Editor for etterprovbare tips-backuper.

create table if not exists public.prediction_backups (
  id uuid primary key default gen_random_uuid(),
  backup_key text not null unique,
  backup_type text not null check (backup_type in ('full-vm', 'daglig')),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  match_date date,
  cutoff_at timestamptz not null,
  created_at timestamptz not null default now(),
  user_count integer not null,
  prediction_count integer not null,
  snapshot jsonb not null,
  email_sent boolean not null default false,
  email_error text
);

alter table public.prediction_backups
  add column if not exists backup_key text,
  add column if not exists user_count integer;

update public.prediction_backups
set backup_key =
  case
    when backup_type = 'daglig' then 'daglig-' || coalesce(match_date::text, id::text)
    else 'full-vm-' || id::text
  end
where backup_key is null;

update public.prediction_backups
set user_count = 0
where user_count is null;

alter table public.prediction_backups
  alter column backup_key set not null,
  alter column user_count set not null;

create unique index if not exists prediction_backups_backup_key_idx
  on public.prediction_backups (backup_key);

alter table public.prediction_backups enable row level security;

drop policy if exists "Admins can read prediction backups"
  on public.prediction_backups;

create policy "Admins can read prediction backups"
  on public.prediction_backups for select
  to authenticated
  using (public.is_admin());
