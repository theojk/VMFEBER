-- Kjor denne i Supabase SQL Editor for sikre profilinnstillinger.

drop policy if exists "Users can update their own profile" on public.profiles;
revoke update on public.profiles from authenticated;

create or replace function public.update_own_username(new_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_username text;
begin
  if auth.uid() is null then
    raise exception 'Du ma vaere innlogget.';
  end if;

  clean_username := trim(new_username);
  if length(clean_username) < 2 or length(clean_username) > 30 then
    raise exception 'Brukernavn ma vaere mellom 2 og 30 tegn.';
  end if;

  update public.profiles
  set username = clean_username
  where id = auth.uid();

  return clean_username;
end;
$$;

grant execute on function public.update_own_username(text) to authenticated;

