-- Kjor denne i Supabase SQL Editor for sikkert innsyn i ligamedlemmers tips.

create or replace function public.get_league_member_predictions(
  selected_league_id uuid,
  selected_user_id uuid,
  selected_competition_slug text,
  selected_match_day date default null
)
returns table (
  username text,
  match_id uuid,
  match_date date,
  kickoff_at timestamptz,
  stage text,
  group_name text,
  home_team text,
  away_team text,
  result_home_score integer,
  result_away_score integer,
  predicted_home_score integer,
  predicted_away_score integer,
  predicted_extra_time_home_score integer,
  predicted_extra_time_away_score integer,
  predicted_penalty_home_score integer,
  predicted_penalty_away_score integer,
  points integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_competition public.competitions;
  full_vm_deadline timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Du ma vaere innlogget.';
  end if;

  if not exists (
    select 1
    from public.league_members membership
    where membership.league_id = selected_league_id
      and membership.user_id = auth.uid()
  ) then
    raise exception 'Du har ikke tilgang til denne ligaen.';
  end if;

  if not exists (
    select 1
    from public.league_members membership
    where membership.league_id = selected_league_id
      and membership.user_id = selected_user_id
  ) then
    raise exception 'Brukeren er ikke medlem av denne ligaen.';
  end if;

  select *
  into selected_competition
  from public.competitions competition
  where competition.slug = selected_competition_slug
    and competition.slug in ('full-vm', 'daglig')
    and competition.is_active = true;

  if selected_competition.id is null then
    raise exception 'Ugyldig konkurranse.';
  end if;

  if selected_competition_slug = 'full-vm' then
    select min(match.kickoff_at) - interval '2 hours'
    into full_vm_deadline
    from public.matches match;

    if full_vm_deadline is null or now() < full_vm_deadline then
      raise exception 'Full VM-tipsene blir synlige etter den samlede fristen.';
    end if;
  elsif selected_match_day is not null and now() < (
    selected_match_day + selected_competition.daily_lock_time
  ) at time zone selected_competition.timezone then
    raise exception 'Dagens tips blir synlige etter kl. 12:00 norsk tid.';
  end if;

  return query
  select
    profile.username,
    match.id,
    (match.kickoff_at at time zone selected_competition.timezone)::date,
    match.kickoff_at,
    match.stage,
    match.group_name,
    match.home_team,
    match.away_team,
    match.home_score,
    match.away_score,
    prediction.home_score,
    prediction.away_score,
    prediction.extra_time_home_score,
    prediction.extra_time_away_score,
    prediction.penalty_home_score,
    prediction.penalty_away_score,
    prediction.points
  from public.profiles profile
  join public.match_predictions prediction
    on prediction.user_id = profile.id
   and prediction.competition_id = selected_competition.id
  join public.matches match on match.id = prediction.match_id
  where profile.id = selected_user_id
    and (
      selected_competition_slug = 'full-vm'
      or (
        (selected_match_day is null
          or (match.kickoff_at at time zone selected_competition.timezone)::date = selected_match_day)
        and now() >= (
          (match.kickoff_at at time zone selected_competition.timezone)::date
          + selected_competition.daily_lock_time
        ) at time zone selected_competition.timezone
      )
    )
  order by match.kickoff_at;
end;
$$;

revoke all on function public.get_league_member_predictions(uuid, uuid, text, date)
  from public, anon;
grant execute on function public.get_league_member_predictions(uuid, uuid, text, date)
  to authenticated;
