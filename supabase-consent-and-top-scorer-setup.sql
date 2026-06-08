-- Kjor denne i Supabase SQL Editor for e-postsamtykke og lagret toppscorertips.

alter table public.profiles
  add column if not exists email_contact_consent boolean not null default false,
  add column if not exists email_contact_consent_at timestamptz;

alter table public.bonus_questions
  add column if not exists slug text unique;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text;
  requested_invite_code text;
  accepted_invite_code text;
  requested_email_consent boolean;
begin
  requested_username := new.raw_user_meta_data ->> 'username';
  requested_invite_code := nullif(trim(new.raw_user_meta_data ->> 'invite_code'), '');
  requested_email_consent := coalesce((new.raw_user_meta_data ->> 'email_contact_consent')::boolean, false);

  if requested_invite_code is not null then
    update public.invitations
    set use_count = use_count + 1
    where lower(code) = lower(requested_invite_code)
      and (max_uses is null or use_count < max_uses)
    returning code into accepted_invite_code;
  end if;

  insert into public.profiles (
    id, username, email, invite_code, registration_source,
    email_contact_consent, email_contact_consent_at
  )
  values (
    new.id,
    public.profile_username_for_user(new.id, new.email, requested_username),
    new.email,
    accepted_invite_code,
    case when accepted_invite_code is null then 'open' else 'invitation' end,
    requested_email_consent,
    case when requested_email_consent then now() else null end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

insert into public.bonus_questions (competition_id, slug, label, points, sort_order)
select competition.id, 'toppscorer', 'Toppscorer', 5, 1
from public.competitions competition
where competition.slug = 'full-vm'
on conflict (slug) do update set label = excluded.label, points = excluded.points;

create or replace function public.save_top_scorer_prediction(player_name text)
returns public.bonus_predictions
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_question_id uuid;
  deadline timestamptz;
  saved_prediction public.bonus_predictions;
begin
  if auth.uid() is null then raise exception 'Du ma vaere innlogget.'; end if;

  select min(kickoff_at) - interval '2 hours' into deadline from public.matches;
  if deadline is null or now() >= deadline then
    raise exception 'Full VM-fristen har utlopet.';
  end if;
  if char_length(trim(player_name)) < 2 then
    raise exception 'Skriv inn navnet pa en spiller.';
  end if;

  select id into selected_question_id from public.bonus_questions where slug = 'toppscorer';

  insert into public.bonus_predictions (user_id, question_id, answer, updated_at)
  values (auth.uid(), selected_question_id, trim(player_name), now())
  on conflict (user_id, question_id) do update
  set answer = excluded.answer, updated_at = now()
  returning * into saved_prediction;

  return saved_prediction;
end;
$$;

create or replace function public.get_my_top_scorer_prediction()
returns text
language sql
security definer
set search_path = public
as $$
  select prediction.answer
  from public.bonus_predictions prediction
  join public.bonus_questions question on question.id = prediction.question_id
  where prediction.user_id = auth.uid() and question.slug = 'toppscorer'
  limit 1;
$$;

create or replace function public.set_email_contact_consent(accepted boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email_contact_consent = coalesce(accepted, false),
      email_contact_consent_at = case when accepted then now() else null end
  where id = auth.uid();
  return coalesce(accepted, false);
end;
$$;

drop function if exists public.get_admin_users();

create function public.get_admin_users()
returns table (
  id uuid,
  username text,
  email text,
  email_contact_consent boolean,
  registration_source text,
  invite_code text,
  created_at timestamptz,
  league_names text[],
  full_prediction_count bigint,
  daily_prediction_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Kun admin kan se brukeroversikten.';
  end if;

  return query
  select
    profile.id,
    profile.username,
    profile.email,
    profile.email_contact_consent,
    profile.registration_source,
    profile.invite_code,
    profile.created_at,
    coalesce((
      select array_agg(league.name order by league.is_main desc, league.name)
      from public.league_members membership
      join public.leagues league on league.id = membership.league_id
      where membership.user_id = profile.id
    ), array[]::text[]),
    (
      select count(*)
      from public.match_predictions prediction
      join public.competitions competition on competition.id = prediction.competition_id
      where prediction.user_id = profile.id and competition.slug = 'full-vm'
    ),
    (
      select count(*)
      from public.match_predictions prediction
      join public.competitions competition on competition.id = prediction.competition_id
      where prediction.user_id = profile.id and competition.slug = 'daglig'
    )
  from public.profiles profile
  order by profile.created_at desc;
end;
$$;

revoke all on function public.save_top_scorer_prediction(text) from public, anon;
revoke all on function public.get_my_top_scorer_prediction() from public, anon;
revoke all on function public.set_email_contact_consent(boolean) from public, anon;
revoke all on function public.get_admin_users() from public, anon;
grant execute on function public.save_top_scorer_prediction(text) to authenticated;
grant execute on function public.get_my_top_scorer_prediction() to authenticated;
grant execute on function public.set_email_contact_consent(boolean) to authenticated;
grant execute on function public.get_admin_users() to authenticated;
