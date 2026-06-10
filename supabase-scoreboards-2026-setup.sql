-- Kjor denne for tydelige Full VM-, Daglig samlet- og I dag-poengtavler.
-- Full VM inkluderer bonuspoeng. I dag returnerer bade dagens og samlet Daglig.

drop function if exists public.get_league_leaderboard(uuid, text, date);

create function public.get_league_leaderboard(
  selected_league_id uuid,
  competition_slug text,
  match_day date default null
)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  points bigint,
  match_points bigint,
  bonus_points bigint,
  exact_results bigint,
  scored_predictions bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_competition_slug alias for $2;
begin
  if not exists (
    select 1 from public.league_members membership
    where membership.league_id = selected_league_id and membership.user_id = auth.uid()
  ) then raise exception 'Du har ikke tilgang til denne ligaen.'; end if;

  if requested_competition_slug not in ('full-vm', 'daglig') then
    raise exception 'Ugyldig konkurranse.';
  end if;

  return query
  with member_scores as (
    select
      profile.id as member_user_id,
      profile.username as member_username,
      coalesce((
        select sum(prediction.points)
        from public.match_predictions prediction
        where prediction.user_id = profile.id
          and prediction.competition_id = (
            select competition.id from public.competitions competition
            where competition.slug = requested_competition_slug limit 1
          )
          and (
            match_day is null or requested_competition_slug <> 'daglig'
            or exists (
              select 1 from public.matches selected_match
              where selected_match.id = prediction.match_id
                and (selected_match.kickoff_at at time zone 'Europe/Oslo')::date = match_day
            )
          )
      ), 0)::bigint as member_match_points,
      case when requested_competition_slug = 'full-vm' then coalesce((
        select sum(prediction.points)
        from public.bonus_predictions prediction
        join public.bonus_questions question on question.id = prediction.question_id
        join public.competitions competition on competition.id = question.competition_id
        where prediction.user_id = profile.id and competition.slug = 'full-vm'
      ), 0)::bigint else 0::bigint end as member_bonus_points,
      coalesce((
        select count(*) from public.match_predictions prediction
        where prediction.user_id = profile.id
          and prediction.points = 3
          and prediction.competition_id = (
            select competition.id from public.competitions competition
            where competition.slug = requested_competition_slug limit 1
          )
          and (
            match_day is null or requested_competition_slug <> 'daglig'
            or exists (
              select 1 from public.matches selected_match
              where selected_match.id = prediction.match_id
                and (selected_match.kickoff_at at time zone 'Europe/Oslo')::date = match_day
            )
          )
      ), 0)::bigint as member_exact_results,
      coalesce((
        select count(*) from public.match_predictions prediction
        where prediction.user_id = profile.id
          and prediction.points > 0
          and prediction.competition_id = (
            select competition.id from public.competitions competition
            where competition.slug = requested_competition_slug limit 1
          )
          and (
            match_day is null or requested_competition_slug <> 'daglig'
            or exists (
              select 1 from public.matches selected_match
              where selected_match.id = prediction.match_id
                and (selected_match.kickoff_at at time zone 'Europe/Oslo')::date = match_day
            )
          )
      ), 0)::bigint as member_scored_predictions
    from public.league_members membership
    join public.profiles profile on profile.id = membership.user_id
    where membership.league_id = selected_league_id
  )
  select
    dense_rank() over (
      order by member_match_points + member_bonus_points desc,
        member_exact_results desc, member_username asc
    ),
    member_user_id,
    member_username,
    member_match_points + member_bonus_points,
    member_match_points,
    member_bonus_points,
    member_exact_results,
    member_scored_predictions
  from member_scores
  order by 1, member_username;
end;
$$;

create or replace function public.get_league_daily_overview(
  selected_league_id uuid,
  selected_match_day date default ((now() at time zone 'Europe/Oslo')::date)
)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  today_points bigint,
  total_points bigint,
  today_exact_results bigint,
  today_scored_predictions bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.league_members membership
    where membership.league_id = selected_league_id and membership.user_id = auth.uid()
  ) then raise exception 'Du har ikke tilgang til denne ligaen.'; end if;

  return query
  with daily_competition as (
    select competition.id from public.competitions competition where competition.slug = 'daglig' limit 1
  ),
  member_scores as (
    select
      profile.id as member_user_id,
      profile.username as member_username,
      coalesce(sum(prediction.points) filter (
        where (match.kickoff_at at time zone 'Europe/Oslo')::date = selected_match_day
      ), 0)::bigint as member_today_points,
      coalesce(sum(prediction.points), 0)::bigint as member_total_points,
      count(prediction.id) filter (
        where prediction.points = 3
          and (match.kickoff_at at time zone 'Europe/Oslo')::date = selected_match_day
      )::bigint as member_today_exact_results,
      count(prediction.id) filter (
        where prediction.points > 0
          and (match.kickoff_at at time zone 'Europe/Oslo')::date = selected_match_day
      )::bigint as member_today_scored_predictions
    from public.league_members membership
    join public.profiles profile on profile.id = membership.user_id
    left join public.match_predictions prediction
      on prediction.user_id = profile.id
     and prediction.competition_id = (select id from daily_competition)
    left join public.matches match on match.id = prediction.match_id
    where membership.league_id = selected_league_id
    group by profile.id, profile.username
  )
  select
    dense_rank() over (
      order by member_today_points desc, member_today_exact_results desc, member_total_points desc, member_username asc
    ),
    member_user_id,
    member_username,
    member_today_points,
    member_total_points,
    member_today_exact_results,
    member_today_scored_predictions
  from member_scores
  order by 1, member_username;
end;
$$;

revoke all on function public.get_league_leaderboard(uuid, text, date) from public, anon;
revoke all on function public.get_league_daily_overview(uuid, date) from public, anon;
grant execute on function public.get_league_leaderboard(uuid, text, date) to authenticated;
grant execute on function public.get_league_daily_overview(uuid, date) to authenticated;
