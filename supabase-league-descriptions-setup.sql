-- Kjor denne i Supabase SQL Editor for beskrivelser pa ligaer.

alter table public.leagues
  add column if not exists description text;

drop function if exists public.create_league(text, boolean);

create function public.create_league(
  league_name text,
  league_is_public boolean default false,
  league_description text default null
)
returns public.leagues
language plpgsql
security definer
set search_path = public
as $$
declare
  created_league public.leagues;
  clean_name text;
  clean_description text;
  clean_code text;
begin
  if auth.uid() is null then
    raise exception 'Du ma vaere innlogget.';
  end if;

  clean_name := trim(league_name);
  clean_description := nullif(trim(league_description), '');
  if char_length(clean_name) < 2 or char_length(clean_name) > 60 then
    raise exception 'Liganavnet ma vaere mellom 2 og 60 tegn.';
  end if;
  if clean_description is not null and char_length(clean_description) > 240 then
    raise exception 'Ligabeskrivelsen kan vaere maks 240 tegn.';
  end if;

  loop
    clean_code := 'VM' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.leagues where lower(code) = lower(clean_code));
  end loop;

  insert into public.leagues (name, description, code, created_by, is_main, is_public)
  values (clean_name, clean_description, clean_code, auth.uid(), false, coalesce(league_is_public, false))
  returning * into created_league;

  insert into public.league_members (league_id, user_id, role)
  values (created_league.id, auth.uid(), 'owner')
  on conflict (league_id, user_id) do update set role = 'owner';

  return created_league;
end;
$$;

drop function if exists public.get_my_leagues();

create function public.get_my_leagues()
returns table (
  id uuid,
  name text,
  description text,
  code text,
  is_main boolean,
  is_public boolean,
  member_role text,
  member_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    league.id, league.name, league.description, league.code, league.is_main, league.is_public,
    membership.role,
    (select count(*) from public.league_members members where members.league_id = league.id)
  from public.leagues league
  join public.league_members membership
    on membership.league_id = league.id and membership.user_id = auth.uid()
  order by league.is_main desc, league.created_at asc;
$$;

drop function if exists public.get_public_leagues();

create function public.get_public_leagues()
returns table (
  id uuid,
  name text,
  description text,
  member_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    league.id, league.name, league.description,
    (select count(*) from public.league_members members where members.league_id = league.id)
  from public.leagues league
  where league.is_public = true and league.is_main = false
    and not exists (
      select 1 from public.league_members own_membership
      where own_membership.league_id = league.id and own_membership.user_id = auth.uid()
    )
  order by 4 desc, league.created_at desc;
$$;

create or replace function public.update_league_description(
  selected_league_id uuid,
  league_description text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_description text;
begin
  if not exists (
    select 1 from public.league_members membership
    where membership.league_id = selected_league_id
      and membership.user_id = auth.uid()
      and membership.role = 'owner'
  ) then
    raise exception 'Kun ligaeieren kan endre beskrivelsen.';
  end if;

  clean_description := nullif(trim(league_description), '');
  if clean_description is not null and char_length(clean_description) > 240 then
    raise exception 'Ligabeskrivelsen kan vaere maks 240 tegn.';
  end if;

  update public.leagues
  set description = clean_description
  where id = selected_league_id and is_main = false;

  return clean_description;
end;
$$;

revoke all on function public.create_league(text, boolean, text) from public, anon;
revoke all on function public.get_my_leagues() from public, anon;
revoke all on function public.get_public_leagues() from public, anon;
revoke all on function public.update_league_description(uuid, text) from public, anon;
grant execute on function public.create_league(text, boolean, text) to authenticated;
grant execute on function public.get_my_leagues() to authenticated;
grant execute on function public.get_public_leagues() to authenticated;
grant execute on function public.update_league_description(uuid, text) to authenticated;
