-- VM FEBER databaseoppsett for Supabase
-- Kjor denne filen i Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null,
  invite_code text,
  registration_source text not null default 'open',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  created_by uuid references public.profiles(id) on delete set null,
  max_uses integer,
  use_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  is_main boolean not null default false,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create table if not exists public.competitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  lock_type text not null check (lock_type in ('tournament', 'daily')),
  lock_description text not null,
  starts_at timestamptz,
  daily_lock_time time,
  timezone text not null default 'Europe/Oslo',
  is_active boolean not null default true
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  stage text not null,
  group_name text,
  home_team text not null,
  away_team text not null,
  kickoff_at timestamptz not null,
  home_score integer,
  away_score integer,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'finished')),
  created_at timestamptz not null default now()
);

create table if not exists public.match_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  home_score integer not null check (home_score >= 0),
  away_score integer not null check (away_score >= 0),
  points integer not null default 0,
  locked_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, competition_id, match_id)
);

create table if not exists public.bonus_questions (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  label text not null,
  points integer not null default 0,
  answer text,
  sort_order integer not null default 0
);

create table if not exists public.bonus_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.bonus_questions(id) on delete cascade,
  answer text not null,
  points integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, question_id)
);

insert into public.competitions (slug, name, lock_type, lock_description, starts_at, daily_lock_time)
values
  ('full-vm', 'Full VM-konkurranse', 'tournament', 'Alt ma leveres 2 timer for forste kamp.', null, null),
  ('daglig', 'Daglig konkurranse', 'daily', 'Dagens kamper ma leveres innen kl. 12:00 norsk tid.', null, '12:00')
on conflict (slug) do nothing;

insert into public.leagues (name, code, is_main)
values ('Hovedkonkurranse', 'ALL', true)
on conflict (code) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
    and is_admin = true
  );
$$;

create or replace function public.join_league_by_code(join_code text)
returns public.leagues
language plpgsql
security definer
set search_path = public
as $$
declare
  found_league public.leagues;
begin
  select *
  into found_league
  from public.leagues
  where lower(code) = lower(trim(join_code));

  if found_league.id is null then
    raise exception 'Fant ingen liga med den koden.';
  end if;

  insert into public.league_members (league_id, user_id)
  values (found_league.id, auth.uid())
  on conflict (league_id, user_id) do nothing;

  return found_league;
end;
$$;

alter table public.profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.competitions enable row level security;
alter table public.matches enable row level security;
alter table public.match_predictions enable row level security;
alter table public.bonus_questions enable row level security;
alter table public.bonus_predictions enable row level security;

create policy "Profiles are readable by signed in users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admins can read invitations"
  on public.invitations for select
  to authenticated
  using (public.is_admin());

create policy "Admins can create invitations"
  on public.invitations for insert
  to authenticated
  with check (public.is_admin());

create policy "Competitions are readable by everyone"
  on public.competitions for select
  to anon, authenticated
  using (is_active = true);

create policy "Matches are readable by everyone"
  on public.matches for select
  to anon, authenticated
  using (true);

create policy "Bonus questions are readable by everyone"
  on public.bonus_questions for select
  to anon, authenticated
  using (true);

create policy "Users can read leagues they belong to plus main league"
  on public.leagues for select
  to authenticated
  using (
    is_main = true
    or exists (
      select 1 from public.league_members
      where league_members.league_id = leagues.id
      and league_members.user_id = auth.uid()
    )
  );

create policy "Users can create leagues"
  on public.leagues for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "Users can read their league memberships"
  on public.league_members for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "Users can join leagues"
  on public.league_members for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can read own match predictions"
  on public.match_predictions for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can upsert own match predictions"
  on public.match_predictions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own match predictions"
  on public.match_predictions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can read own bonus predictions"
  on public.bonus_predictions for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert own bonus predictions"
  on public.bonus_predictions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update own bonus predictions"
  on public.bonus_predictions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
