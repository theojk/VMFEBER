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

alter table public.prediction_backups enable row level security;

create policy "Admins can read prediction backups"
  on public.prediction_backups for select
  to authenticated
  using (public.is_admin());
