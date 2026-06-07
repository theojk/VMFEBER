-- Kjor denne en gang i Supabase SQL Editor for sluttspilltips.

alter table public.match_predictions
  add column if not exists extra_time_home_score integer check (extra_time_home_score >= 0),
  add column if not exists extra_time_away_score integer check (extra_time_away_score >= 0),
  add column if not exists penalty_home_score integer check (penalty_home_score >= 0),
  add column if not exists penalty_away_score integer check (penalty_away_score >= 0);

drop function if exists public.save_match_prediction(text, uuid, integer, integer);

create or replace function public.save_match_prediction(
  competition_slug text,
  selected_match_id uuid,
  predicted_home_score integer,
  predicted_away_score integer,
  predicted_extra_time_home_score integer default null,
  predicted_extra_time_away_score integer default null,
  predicted_penalty_home_score integer default null,
  predicted_penalty_away_score integer default null
)
returns public.match_predictions
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_competition public.competitions;
  selected_match public.matches;
  deadline timestamptz;
  saved_prediction public.match_predictions;
  is_knockout boolean;
begin
  if auth.uid() is null then
    raise exception 'Du ma vaere innlogget for a lagre tips.';
  end if;

  if predicted_home_score < 0 or predicted_away_score < 0 then
    raise exception 'Resultatet kan ikke inneholde negative tall.';
  end if;

  select * into selected_competition
  from public.competitions
  where slug = competition_slug and is_active = true;

  select * into selected_match
  from public.matches
  where id = selected_match_id;

  if selected_competition.id is null or selected_match.id is null then
    raise exception 'Fant ikke konkurransen eller kampen.';
  end if;

  is_knockout := selected_match.stage <> 'GROUP_STAGE';

  if is_knockout and predicted_home_score = predicted_away_score then
    if predicted_extra_time_home_score is null or predicted_extra_time_away_score is null then
      raise exception 'Uavgjort sluttspilltips ma avgjores etter ekstraomganger.';
    end if;
    if predicted_extra_time_home_score = predicted_extra_time_away_score
       and (
         predicted_penalty_home_score is null
         or predicted_penalty_away_score is null
         or predicted_penalty_home_score = predicted_penalty_away_score
       ) then
      raise exception 'Uavgjort etter ekstraomganger ma avgjores pa straffespark.';
    end if;
  end if;

  if selected_competition.lock_type = 'tournament' then
    select min(kickoff_at) - interval '2 hours' into deadline from public.matches;
  else
    deadline := (
      (selected_match.kickoff_at at time zone selected_competition.timezone)::date
      + selected_competition.daily_lock_time
    ) at time zone selected_competition.timezone;
  end if;

  if deadline is null or now() >= deadline then
    raise exception 'Fristen for dette tipset har utlopet.';
  end if;

  insert into public.match_predictions (
    user_id, competition_id, match_id, home_score, away_score,
    extra_time_home_score, extra_time_away_score, penalty_home_score, penalty_away_score,
    source, updated_at
  )
  values (
    auth.uid(), selected_competition.id, selected_match.id, predicted_home_score, predicted_away_score,
    case when is_knockout and predicted_home_score = predicted_away_score then predicted_extra_time_home_score end,
    case when is_knockout and predicted_home_score = predicted_away_score then predicted_extra_time_away_score end,
    case when is_knockout and predicted_home_score = predicted_away_score
      and predicted_extra_time_home_score = predicted_extra_time_away_score then predicted_penalty_home_score end,
    case when is_knockout and predicted_home_score = predicted_away_score
      and predicted_extra_time_home_score = predicted_extra_time_away_score then predicted_penalty_away_score end,
    'explicit', now()
  )
  on conflict (user_id, competition_id, match_id)
  do update set
    home_score = excluded.home_score,
    away_score = excluded.away_score,
    extra_time_home_score = excluded.extra_time_home_score,
    extra_time_away_score = excluded.extra_time_away_score,
    penalty_home_score = excluded.penalty_home_score,
    penalty_away_score = excluded.penalty_away_score,
    source = 'explicit',
    updated_at = now()
  returning * into saved_prediction;

  return saved_prediction;
end;
$$;

grant execute on function public.save_match_prediction(
  text, uuid, integer, integer, integer, integer, integer, integer
) to authenticated;

create or replace function public.fill_daily_predictions_from_full(target_date date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  full_competition_id uuid;
  daily_competition_id uuid;
  copied_count integer;
begin
  select id into full_competition_id from public.competitions where slug = 'full-vm';
  select id into daily_competition_id from public.competitions where slug = 'daglig';

  insert into public.match_predictions (
    user_id, competition_id, match_id, home_score, away_score,
    extra_time_home_score, extra_time_away_score, penalty_home_score, penalty_away_score,
    source, updated_at
  )
  select
    full_prediction.user_id, daily_competition_id, full_prediction.match_id,
    full_prediction.home_score, full_prediction.away_score,
    full_prediction.extra_time_home_score, full_prediction.extra_time_away_score,
    full_prediction.penalty_home_score, full_prediction.penalty_away_score,
    'full-vm-inherited', now()
  from public.match_predictions full_prediction
  join public.matches match on match.id = full_prediction.match_id
  where full_prediction.competition_id = full_competition_id
    and (match.kickoff_at at time zone 'Europe/Oslo')::date = target_date
  on conflict (user_id, competition_id, match_id) do nothing;

  get diagnostics copied_count = row_count;
  return copied_count;
end;
$$;

revoke execute on function public.fill_daily_predictions_from_full(date) from public, anon, authenticated;
grant execute on function public.fill_daily_predictions_from_full(date) to service_role;
