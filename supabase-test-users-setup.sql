-- Kjor denne i Supabase SQL Editor for adminbeskyttede testbrukere.

create table if not exists public.test_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.test_user_predictions (
  id uuid primary key default gen_random_uuid(),
  test_user_id uuid not null references public.test_users(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  home_score integer not null check (home_score between 0 and 4),
  away_score integer not null check (away_score between 0 and 4),
  points integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (test_user_id, competition_id, match_id)
);

alter table public.test_users enable row level security;
alter table public.test_user_predictions enable row level security;

drop policy if exists "Admins can read test users" on public.test_users;
drop policy if exists "Admins can read test user predictions" on public.test_user_predictions;

create policy "Admins can read test users"
  on public.test_users for select
  to authenticated
  using (public.is_admin());

create policy "Admins can read test user predictions"
  on public.test_user_predictions for select
  to authenticated
  using (public.is_admin());

create or replace function public.create_test_user(test_username text)
returns public.test_users
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_username text;
  created_test_user public.test_users;
begin
  if not public.is_admin() then
    raise exception 'Kun admin kan opprette testbrukere.';
  end if;

  clean_username := trim(test_username);
  if char_length(clean_username) < 2 or char_length(clean_username) > 30 then
    raise exception 'Testbrukernavnet ma vaere mellom 2 og 30 tegn.';
  end if;

  if exists (select 1 from public.profiles where lower(username) = lower(clean_username))
    or exists (select 1 from public.test_users where lower(username) = lower(clean_username)) then
    raise exception 'Brukernavnet er allerede i bruk.';
  end if;

  insert into public.test_users (username, created_by)
  values (clean_username, auth.uid())
  returning * into created_test_user;

  return created_test_user;
end;
$$;

create or replace function public.get_admin_test_users()
returns table (
  id uuid,
  username text,
  created_at timestamptz,
  full_prediction_count bigint,
  daily_prediction_count bigint,
  full_points bigint,
  daily_points bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Kun admin kan se testbrukere.';
  end if;

  return query
  select
    test_user.id,
    test_user.username,
    test_user.created_at,
    count(prediction.id) filter (where competition.slug = 'full-vm')::bigint,
    count(prediction.id) filter (where competition.slug = 'daglig')::bigint,
    coalesce(sum(prediction.points) filter (where competition.slug = 'full-vm'), 0)::bigint,
    coalesce(sum(prediction.points) filter (where competition.slug = 'daglig'), 0)::bigint
  from public.test_users test_user
  left join public.test_user_predictions prediction on prediction.test_user_id = test_user.id
  left join public.competitions competition on competition.id = prediction.competition_id
  group by test_user.id, test_user.username, test_user.created_at
  order by test_user.created_at desc;
end;
$$;

create or replace function public.randomize_test_user_predictions(
  selected_test_user_id uuid,
  competition_slug text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_competition_id uuid;
  filled_count integer;
begin
  if not public.is_admin() then
    raise exception 'Kun admin kan fylle testbrukertips.';
  end if;

  if not exists (select 1 from public.test_users where id = selected_test_user_id) then
    raise exception 'Fant ikke testbrukeren.';
  end if;

  select id into selected_competition_id
  from public.competitions
  where slug = competition_slug
    and slug in ('full-vm', 'daglig');

  if selected_competition_id is null then
    raise exception 'Ugyldig konkurranse.';
  end if;

  insert into public.test_user_predictions (
    test_user_id,
    competition_id,
    match_id,
    home_score,
    away_score,
    points,
    updated_at
  )
  select
    selected_test_user_id,
    selected_competition_id,
    match.id,
    floor(random() * 5)::integer,
    floor(random() * 5)::integer,
    0,
    now()
  from public.matches match
  on conflict (test_user_id, competition_id, match_id)
  do update set
    home_score = excluded.home_score,
    away_score = excluded.away_score,
    points = 0,
    updated_at = now();

  get diagnostics filled_count = row_count;

  update public.test_user_predictions prediction
  set points = case
    when prediction.home_score = m.home_score
     and prediction.away_score = m.away_score then 3
    when sign(prediction.home_score - prediction.away_score)
       = sign(m.home_score - m.away_score) then 1
    else 0
  end
  from public.matches m
  where m.id = prediction.match_id
    and prediction.test_user_id = selected_test_user_id
    and prediction.competition_id = selected_competition_id
    and m.status = 'finished'
    and m.home_score is not null
    and m.away_score is not null;

  return filled_count;
end;
$$;

create or replace function public.delete_test_user(selected_test_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Kun admin kan slette testbrukere.';
  end if;

  delete from public.test_users where id = selected_test_user_id;
  return found;
end;
$$;

create or replace function public.recalculate_test_user_prediction_points()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'Kun admin kan beregne testbrukerpoeng.';
  end if;

  update public.test_user_predictions prediction
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

revoke all on function public.create_test_user(text) from public, anon;
revoke all on function public.get_admin_test_users() from public, anon;
revoke all on function public.randomize_test_user_predictions(uuid, text) from public, anon;
revoke all on function public.delete_test_user(uuid) from public, anon;
revoke all on function public.recalculate_test_user_prediction_points() from public, anon;

grant execute on function public.create_test_user(text) to authenticated;
grant execute on function public.get_admin_test_users() to authenticated;
grant execute on function public.randomize_test_user_predictions(uuid, text) to authenticated;
grant execute on function public.delete_test_user(uuid) to authenticated;
grant execute on function public.recalculate_test_user_prediction_points() to authenticated, service_role;
