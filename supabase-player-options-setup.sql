-- Kjor denne for spiller- og lagvalg til bonussporsmal.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  fifa_code text not null unique,
  name text not null,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  fifa_team_code text not null,
  team_name text not null,
  squad_number integer not null check (squad_number between 1 and 99),
  position text not null check (position in ('GK', 'DF', 'MF', 'FW')),
  player_name text not null,
  first_names text,
  last_names text,
  shirt_name text not null,
  date_of_birth date,
  club text,
  height_cm integer,
  search_text text generated always as (
    lower(
      coalesce(player_name, '') || ' ' || coalesce(first_names, '') || ' '
      || coalesce(last_names, '') || ' ' || coalesce(shirt_name, '') || ' '
      || coalesce(team_name, '') || ' ' || coalesce(fifa_team_code, '')
    )
  ) stored,
  is_active boolean not null default true,
  replaced_by_player_id uuid references public.players(id) on delete set null,
  source text not null default 'FIFA Squad List v1 2026-06-10',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fifa_team_code, squad_number),
  unique (fifa_team_code, player_name, date_of_birth)
);

create index if not exists players_team_idx on public.players(team_id);
create index if not exists players_fifa_team_code_idx on public.players(fifa_team_code);
create index if not exists players_position_idx on public.players(position);
create index if not exists players_search_text_idx on public.players using gin (search_text gin_trgm_ops);

alter table public.teams enable row level security;
alter table public.players enable row level security;

drop policy if exists "Teams are readable by everyone" on public.teams;
create policy "Teams are readable by everyone"
  on public.teams for select to anon, authenticated using (true);

drop policy if exists "Players are readable by everyone" on public.players;
create policy "Players are readable by everyone"
  on public.players for select to anon, authenticated using (true);

create or replace function public.search_players(
  search_query text default '',
  only_active boolean default true,
  max_results integer default 30
)
returns table (
  id uuid,
  fifa_team_code text,
  team_name text,
  squad_number integer,
  player_position text,
  player_name text,
  shirt_name text,
  club text,
  height_cm integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    player.id,
    player.fifa_team_code,
    player.team_name,
    player.squad_number,
    player.position,
    player.player_name,
    player.shirt_name,
    player.club,
    player.height_cm
  from public.players player
  where (not only_active or player.is_active)
    and (
      nullif(trim(search_query), '') is null
      or player.search_text like '%' || lower(trim(search_query)) || '%'
    )
  order by
    case when lower(player.player_name) = lower(trim(search_query)) then 0 else 1 end,
    player.team_name,
    player.player_name
  limit greatest(1, least(coalesce(max_results, 30), 100));
$$;

revoke all on function public.search_players(text, boolean, integer) from public;
grant execute on function public.search_players(text, boolean, integer) to anon, authenticated;
