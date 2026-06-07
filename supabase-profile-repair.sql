-- Reparerer manglende profiler og oppretter profiler automatisk for nye Auth-brukere.

create or replace function public.profile_username_for_user(
  user_id uuid,
  user_email text,
  requested_username text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  candidate text;
begin
  base_username := nullif(trim(requested_username), '');
  if base_username is null then
    base_username := left(split_part(coalesce(user_email, 'bruker'), '@', 1), 12)
      || '-' || left(user_id::text, 8);
  end if;

  base_username := left(base_username, 21);
  candidate := base_username;

  if exists (select 1 from public.profiles where username = candidate and id <> user_id) then
    candidate := base_username || '-' || left(user_id::text, 8);
  end if;

  return candidate;
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

-- Reparerer alle eksisterende Auth-brukere som mangler profil.
insert into public.profiles (
  id,
  username,
  email,
  registration_source
)
select
  auth_user.id,
  public.profile_username_for_user(
    auth_user.id,
    auth_user.email,
    auth_user.raw_user_meta_data ->> 'username'
  ),
  auth_user.email,
  'open'
from auth.users auth_user
where not exists (
  select 1
  from public.profiles profile
  where profile.id = auth_user.id
)
on conflict (id) do nothing;

-- Sikrer at hovedkontoen fortsatt er admin etter eventuell profilreparasjon.
update public.profiles
set is_admin = true
where email = 'olejoergen@gmail.com';
