-- Kjor denne i Supabase SQL Editor for ekte ligaer og poengtavler.

create or replace function public.create_private_league(
  league_name text,
  requested_code text default null
)
returns public.leagues
language plpgsql
security definer
set search_path = public
as $$
declare
  created_league public.leagues;
  clean_name text;
  clean_code text;
begin
  if auth.uid() is null then
    raise exception 'Du ma vaere innlogget.';
  end if;

  clean_name := trim(league_name);
  if char_length(clean_name) < 2 or char_length(clean_name) > 60 then
    raise exception 'Liganavnet ma vaere mellom 2 og 60 tegn.';
  end if;

  clean_code := upper(regexp_replace(coalesce(nullif(trim(requested_code), ''), clean_name), '[^A-Za-z0-9]', '', 'g'));
  clean_code := left(clean_code, 12);
  if char_length(clean_code) < 4 then
    clean_code := 'VM' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  end if;

  if exists (select 1 from public.leagues where lower(code) = lower(clean_code)) then
    raise exception 'Ligakoden er allerede i bruk. Velg en annen kode.';
  end if;

  insert into public.leagues (name, code, created_by, is_main)
  values (clean_name, clean_code, auth.uid(), false)
  returning * into created_league;

  insert into public.league_members (league_id, user_id, role)
  values (created_league.id, auth.uid(), 'owner')
  on conflict (league_id, user_id) do update set role = 'owner';

  return created_league;
end;
$$;

create or replace function public.get_my_leagues()
returns table (
  id uuid,
  name text,
  code text,
  is_main boolean,
  member_role text,
  member_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    l.id,
    l.name,
    l.code,
    l.is_main,
    lm.role as member_role,
    (select count(*) from public.league_members members where members.league_id = l.id) as member_count
  from public.leagues l
  join public.league_members lm
    on lm.league_id = l.id
   and lm.user_id = auth.uid()
  order by l.is_main desc, l.created_at asc;
$$;

create or replace function public.get_league_leaderboard(
  selected_league_id uuid,
  competition_slug text,
  match_day date default null
)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  points bigint,
  exact_results bigint,
  scored_predictions bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.league_members access_membership
    where access_membership.league_id = selected_league_id
      and access_membership.user_id = auth.uid()
  ) then
    raise exception 'Du har ikke tilgang til denne ligaen.';
  end if;

  if competition_slug not in ('full-vm', 'daglig') then
    raise exception 'Ugyldig konkurranse.';
  end if;

  return query
  with member_scores as (
    select
      p.id as member_user_id,
      p.username as member_username,
      coalesce(sum(mp.points), 0)::bigint as member_points,
      count(mp.id) filter (where mp.points = 3)::bigint as member_exact_results,
      count(mp.id) filter (where mp.points > 0)::bigint as member_scored_predictions
    from public.league_members lm
    join public.profiles p on p.id = lm.user_id
    left join public.match_predictions mp
      on mp.user_id = lm.user_id
     and mp.competition_id = (
       select c.id from public.competitions c where c.slug = competition_slug limit 1
     )
     and (
       match_day is null
       or competition_slug <> 'daglig'
       or exists (
         select 1
         from public.matches selected_match
         where selected_match.id = mp.match_id
           and (selected_match.kickoff_at at time zone 'Europe/Oslo')::date = match_day
       )
     )
    where lm.league_id = selected_league_id
    group by p.id, p.username
  )
  select
    dense_rank() over (
      order by member_points desc, member_exact_results desc, member_username asc
    ) as rank,
    member_user_id,
    member_username,
    member_points,
    member_exact_results,
    member_scored_predictions
  from member_scores
  order by 1, member_username;
end;
$$;

create or replace function public.recalculate_match_prediction_points()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'Kun admin kan beregne poeng.';
  end if;

  update public.match_predictions prediction
  set points = case
    when prediction.home_score = m.home_score
     and prediction.away_score = m.away_score then 3
    when sign(prediction.home_score - prediction.away_score)
       = sign(m.home_score - m.away_score) then 1
    else 0
  end
  from public.matches m
  where m.id = prediction.match_id
    and m.status = 'finished'
    and m.home_score is not null
    and m.away_score is not null;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.create_private_league(text, text) from public, anon;
revoke all on function public.get_my_leagues() from public, anon;
revoke all on function public.get_league_leaderboard(uuid, text, date) from public, anon;
revoke all on function public.recalculate_match_prediction_points() from public, anon;

grant execute on function public.create_private_league(text, text) to authenticated;
grant execute on function public.get_my_leagues() to authenticated;
grant execute on function public.get_league_leaderboard(uuid, text, date) to authenticated;
grant execute on function public.recalculate_match_prediction_points() to authenticated, service_role;

insert into public.league_members (league_id, user_id)
select l.id, p.id
from public.leagues l
cross join public.profiles p
where l.is_main = true
on conflict (league_id, user_id) do nothing;
