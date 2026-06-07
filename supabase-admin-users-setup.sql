-- Kjor denne i Supabase SQL Editor for invitasjoner og adminoversikt.

create or replace function public.validate_invitation_code(check_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.invitations invitation
    where lower(invitation.code) = lower(trim(check_code))
      and (invitation.max_uses is null or invitation.use_count < invitation.max_uses)
  );
$$;

create or replace function public.create_invitation(
  invitation_label text,
  invitation_max_uses integer default null
)
returns public.invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  created_invitation public.invitations;
  clean_label text;
  generated_code text;
begin
  if not public.is_admin() then
    raise exception 'Kun admin kan lage invitasjoner.';
  end if;

  clean_label := trim(invitation_label);
  if char_length(clean_label) < 2 or char_length(clean_label) > 80 then
    raise exception 'Beskrivelsen ma vaere mellom 2 og 80 tegn.';
  end if;

  if invitation_max_uses is not null and invitation_max_uses < 1 then
    raise exception 'Maks antall brukere ma vaere minst 1.';
  end if;

  loop
    generated_code := 'INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (
      select 1 from public.invitations where lower(code) = lower(generated_code)
    );
  end loop;

  insert into public.invitations (code, label, created_by, max_uses)
  values (generated_code, clean_label, auth.uid(), invitation_max_uses)
  returning * into created_invitation;

  return created_invitation;
end;
$$;

create or replace function public.get_admin_invitations()
returns table (
  id uuid,
  code text,
  label text,
  max_uses integer,
  use_count integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Kun admin kan se invitasjoner.';
  end if;

  return query
  select
    invitation.id,
    invitation.code,
    invitation.label,
    invitation.max_uses,
    invitation.use_count,
    invitation.created_at
  from public.invitations invitation
  order by invitation.created_at desc;
end;
$$;

create or replace function public.get_admin_users()
returns table (
  id uuid,
  username text,
  email text,
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
    profile.registration_source,
    profile.invite_code,
    profile.created_at,
    coalesce((
      select array_agg(league.name order by league.is_main desc, league.name)
      from public.league_members membership
      join public.leagues league on league.id = membership.league_id
      where membership.user_id = profile.id
    ), array[]::text[]) as league_names,
    (
      select count(*)
      from public.match_predictions prediction
      join public.competitions competition on competition.id = prediction.competition_id
      where prediction.user_id = profile.id
        and competition.slug = 'full-vm'
    ) as full_prediction_count,
    (
      select count(*)
      from public.match_predictions prediction
      join public.competitions competition on competition.id = prediction.competition_id
      where prediction.user_id = profile.id
        and competition.slug = 'daglig'
    ) as daily_prediction_count
  from public.profiles profile
  order by profile.created_at desc;
end;
$$;

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
begin
  requested_username := new.raw_user_meta_data ->> 'username';
  requested_invite_code := nullif(trim(new.raw_user_meta_data ->> 'invite_code'), '');

  if requested_invite_code is not null then
    update public.invitations
    set use_count = use_count + 1
    where lower(code) = lower(requested_invite_code)
      and (max_uses is null or use_count < max_uses)
    returning code into accepted_invite_code;
  end if;

  insert into public.profiles (
    id,
    username,
    email,
    invite_code,
    registration_source
  )
  values (
    new.id,
    public.profile_username_for_user(new.id, new.email, requested_username),
    new.email,
    accepted_invite_code,
    case when accepted_invite_code is null then 'open' else 'invitation' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;

create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

drop policy if exists "Profiles are readable by signed in users" on public.profiles;
drop policy if exists "Users and admins can read profiles" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
revoke insert on public.profiles from authenticated;

create policy "Users and admins can read profiles"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

revoke all on function public.validate_invitation_code(text) from public;
revoke all on function public.create_invitation(text, integer) from public, anon;
revoke all on function public.get_admin_invitations() from public, anon;
revoke all on function public.get_admin_users() from public, anon;

grant execute on function public.validate_invitation_code(text) to anon, authenticated;
grant execute on function public.create_invitation(text, integer) to authenticated;
grant execute on function public.get_admin_invitations() to authenticated;
grant execute on function public.get_admin_users() to authenticated;

update public.invitations invitation
set use_count = (
  select count(*)
  from public.profiles profile
  where lower(profile.invite_code) = lower(invitation.code)
);
