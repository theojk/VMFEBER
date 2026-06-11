-- Kjor denne sist i Supabase SQL Editor.
-- Kampdag folger America/New_York. Daglig lases ved kampstart.
-- Full VM: kamp 1 og 2 lases ved egen kampstart; kamp 3 og resten lases ved kamp 3.

update public.competitions
set timezone = 'America/New_York',
    daily_lock_time = null,
    lock_description = 'Hver kamp kan endres frem til kampstart.'
where slug = 'daglig';

update public.competitions
set lock_description = 'Kamp 1 og 2 lases ved egen kampstart. Kamp 3 og resten lases ved kampstart i kamp 3.'
where slug = 'full-vm';

create or replace function public.vmfeber_prediction_deadline(
  selected_competition_slug text,
  selected_match_id uuid
)
returns timestamptz
language sql
stable
set search_path = public
as $$
  with ordered_matches as (
    select
      match.id,
      match.kickoff_at,
      row_number() over (order by match.kickoff_at, match.id) as match_number
    from public.matches match
    where match.kickoff_at is not null
  ),
  selected as (
    select * from ordered_matches where id = selected_match_id
  ),
  third_match as (
    select kickoff_at from ordered_matches where match_number = 3
  )
  select case
    when selected_competition_slug = 'daglig' then selected.kickoff_at
    when selected_competition_slug = 'full-vm' and selected.match_number <= 2 then selected.kickoff_at
    when selected_competition_slug = 'full-vm' then third_match.kickoff_at
    else null
  end
  from selected
  left join third_match on true;
$$;

create or replace function public.vmfeber_full_vm_deadline()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select match.kickoff_at
  from public.matches match
  where match.kickoff_at is not null
  order by match.kickoff_at, match.id
  offset 2 limit 1;
$$;

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
  if auth.uid() is null then raise exception 'Du ma vaere innlogget for a lagre tips.'; end if;
  insert into public.profiles (id, username, email, registration_source)
  select auth_user.id,
    public.profile_username_for_user(auth_user.id, auth_user.email, auth_user.raw_user_meta_data ->> 'username'),
    auth_user.email, 'open'
  from auth.users auth_user
  where auth_user.id = auth.uid()
  on conflict (id) do nothing;

  if predicted_home_score < 0 or predicted_away_score < 0
    or coalesce(predicted_extra_time_home_score, 0) < 0
    or coalesce(predicted_extra_time_away_score, 0) < 0
    or coalesce(predicted_penalty_home_score, 0) < 0
    or coalesce(predicted_penalty_away_score, 0) < 0
  then raise exception 'Resultatet kan ikke inneholde negative tall.'; end if;

  select * into selected_competition from public.competitions
  where slug = competition_slug and is_active = true;
  select * into selected_match from public.matches where id = selected_match_id;
  if selected_competition.id is null or selected_match.id is null then
    raise exception 'Fant ikke konkurransen eller kampen.';
  end if;

  deadline := public.vmfeber_prediction_deadline(competition_slug, selected_match_id);
  if deadline is null or now() >= deadline then
    raise exception 'Fristen for dette tipset har utlopet.';
  end if;

  is_knockout := selected_match.stage <> 'GROUP_STAGE';
  if is_knockout and predicted_home_score = predicted_away_score then
    if predicted_extra_time_home_score is null or predicted_extra_time_away_score is null then
      raise exception 'Uavgjort sluttspilltips ma avgjores etter ekstraomganger.';
    end if;
    if predicted_extra_time_home_score < predicted_home_score
      or predicted_extra_time_away_score < predicted_away_score then
      raise exception 'Stillingen etter 120 minutter kan ikke vaere lavere enn etter ordinaer tid.';
    end if;
    if predicted_extra_time_home_score = predicted_extra_time_away_score and (
      predicted_penalty_home_score is null or predicted_penalty_away_score is null
      or predicted_penalty_home_score = predicted_penalty_away_score
    ) then raise exception 'Uavgjort etter ekstraomganger ma avgjores pa straffespark.'; end if;
  end if;

  insert into public.match_predictions (
    user_id, competition_id, match_id, home_score, away_score,
    extra_time_home_score, extra_time_away_score, penalty_home_score, penalty_away_score,
    source, updated_at
  ) values (
    auth.uid(), selected_competition.id, selected_match.id, predicted_home_score, predicted_away_score,
    case when is_knockout and predicted_home_score = predicted_away_score then predicted_extra_time_home_score end,
    case when is_knockout and predicted_home_score = predicted_away_score then predicted_extra_time_away_score end,
    case when is_knockout and predicted_home_score = predicted_away_score
      and predicted_extra_time_home_score = predicted_extra_time_away_score then predicted_penalty_home_score end,
    case when is_knockout and predicted_home_score = predicted_away_score
      and predicted_extra_time_home_score = predicted_extra_time_away_score then predicted_penalty_away_score end,
    'explicit', now()
  )
  on conflict (user_id, competition_id, match_id) do update set
    home_score = excluded.home_score, away_score = excluded.away_score,
    extra_time_home_score = excluded.extra_time_home_score,
    extra_time_away_score = excluded.extra_time_away_score,
    penalty_home_score = excluded.penalty_home_score,
    penalty_away_score = excluded.penalty_away_score,
    source = 'explicit', updated_at = now()
  returning * into saved_prediction;
  return saved_prediction;
end;
$$;

create or replace function public.save_bonus_prediction(question_slug text, answer_value text)
returns public.bonus_predictions
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_question public.bonus_questions;
  saved_prediction public.bonus_predictions;
  number_answer integer;
begin
  if auth.uid() is null then raise exception 'Du ma vaere innlogget.'; end if;
  if now() >= public.vmfeber_full_vm_deadline() then raise exception 'Full VM-fristen har utlopet.'; end if;

  select question.* into selected_question
  from public.bonus_questions question
  join public.competitions competition on competition.id = question.competition_id
  where question.slug = question_slug and question.is_active and competition.slug = 'full-vm';
  if selected_question.id is null then raise exception 'Fant ikke bonussporsmalet.'; end if;
  if nullif(trim(answer_value), '') is null then raise exception 'Velg eller skriv inn et svar.'; end if;

  if selected_question.question_type = 'player' and not exists (
    select 1 from public.players player where player.id::text = answer_value and player.is_active
  ) then raise exception 'Spilleren er ikke et gyldig valg.'; end if;
  if selected_question.question_type = 'team' and not exists (
    select 1 from public.teams team where team.fifa_code = answer_value and team.is_active
  ) then raise exception 'Laget er ikke et gyldig valg.'; end if;
  if selected_question.question_type = 'number' then
    begin number_answer := answer_value::integer;
    exception when invalid_text_representation then raise exception 'Svaret ma vaere et heltall.'; end;
    if selected_question.validation_rule ? 'min'
      and number_answer < (selected_question.validation_rule ->> 'min')::integer
    then raise exception 'Tallet er for lavt.'; end if;
    if selected_question.validation_rule ? 'max'
      and number_answer > (selected_question.validation_rule ->> 'max')::integer
    then raise exception 'Tallet er for hoyt.'; end if;
  end if;
  if selected_question.question_type = 'boolean' and answer_value not in ('true', 'false')
  then raise exception 'Svaret ma vaere ja eller nei.'; end if;

  insert into public.bonus_predictions (user_id, question_id, answer, updated_at)
  values (auth.uid(), selected_question.id, trim(answer_value), now())
  on conflict (user_id, question_id) do update set answer = excluded.answer, updated_at = now()
  returning * into saved_prediction;
  return saved_prediction;
end;
$$;

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
  select full_prediction.user_id, daily_competition_id, full_prediction.match_id,
    full_prediction.home_score, full_prediction.away_score,
    full_prediction.extra_time_home_score, full_prediction.extra_time_away_score,
    full_prediction.penalty_home_score, full_prediction.penalty_away_score,
    'full-vm-inherited', now()
  from public.match_predictions full_prediction
  join public.matches match on match.id = full_prediction.match_id
  where full_prediction.competition_id = full_competition_id
    and (match.kickoff_at at time zone 'America/New_York')::date = target_date
    and match.kickoff_at <= now()
  on conflict (user_id, competition_id, match_id) do update set
    home_score = excluded.home_score,
    away_score = excluded.away_score,
    extra_time_home_score = excluded.extra_time_home_score,
    extra_time_away_score = excluded.extra_time_away_score,
    penalty_home_score = excluded.penalty_home_score,
    penalty_away_score = excluded.penalty_away_score,
    updated_at = now()
  where match_predictions.source = 'full-vm-inherited';
  get diagnostics copied_count = row_count;
  return copied_count;
end;
$$;

grant execute on function public.vmfeber_prediction_deadline(text, uuid) to authenticated;
grant execute on function public.vmfeber_full_vm_deadline() to authenticated;
revoke all on function public.save_match_prediction(text, uuid, integer, integer, integer, integer, integer, integer) from public, anon;
revoke all on function public.save_bonus_prediction(text, text) from public, anon;
grant execute on function public.save_match_prediction(text, uuid, integer, integer, integer, integer, integer, integer) to authenticated;
grant execute on function public.save_bonus_prediction(text, text) to authenticated;
revoke execute on function public.fill_daily_predictions_from_full(date) from public, anon, authenticated;
grant execute on function public.fill_daily_predictions_from_full(date) to service_role;

create or replace function public.get_league_member_predictions(
  selected_league_id uuid,
  selected_user_id uuid,
  selected_competition_slug text,
  selected_match_day date default null
)
returns table (
  username text, match_id uuid, match_date date, kickoff_at timestamptz, stage text,
  group_name text, home_team text, away_team text, result_home_score integer,
  result_away_score integer, predicted_home_score integer, predicted_away_score integer,
  predicted_extra_time_home_score integer, predicted_extra_time_away_score integer,
  predicted_penalty_home_score integer, predicted_penalty_away_score integer, points integer
)
language plpgsql
security definer
set search_path = public
as $$
declare selected_competition public.competitions;
begin
  if auth.uid() is null then raise exception 'Du ma vaere innlogget.'; end if;
  if not exists (select 1 from public.league_members where league_id = selected_league_id and user_id = auth.uid())
    or not exists (select 1 from public.league_members where league_id = selected_league_id and user_id = selected_user_id)
  then raise exception 'Du har ikke tilgang til disse tipsene.'; end if;

  select * into selected_competition from public.competitions
  where slug = selected_competition_slug and slug in ('full-vm', 'daglig') and is_active;
  if selected_competition.id is null then raise exception 'Ugyldig konkurranse.'; end if;

  return query
  select profile.username, match.id, (match.kickoff_at at time zone 'America/New_York')::date,
    match.kickoff_at, match.stage, match.group_name, match.home_team, match.away_team,
    match.home_score, match.away_score, prediction.home_score, prediction.away_score,
    prediction.extra_time_home_score, prediction.extra_time_away_score,
    prediction.penalty_home_score, prediction.penalty_away_score, prediction.points
  from public.profiles profile
  join public.match_predictions prediction
    on prediction.user_id = profile.id and prediction.competition_id = selected_competition.id
  join public.matches match on match.id = prediction.match_id
  where profile.id = selected_user_id
    and (selected_match_day is null
      or (match.kickoff_at at time zone 'America/New_York')::date = selected_match_day)
    and now() >= public.vmfeber_prediction_deadline(selected_competition_slug, match.id)
  order by match.kickoff_at;
end;
$$;

revoke all on function public.get_league_member_predictions(uuid, uuid, text, date) from public, anon;
grant execute on function public.get_league_member_predictions(uuid, uuid, text, date) to authenticated;
