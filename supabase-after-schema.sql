-- VM FEBER ettersteg for Supabase
-- Kjor denne etter supabase-schema.sql hvis skjemaet allerede er opprettet.

create or replace function public.add_user_to_main_league()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  main_league_id uuid;
begin
  select id
  into main_league_id
  from public.leagues
  where is_main = true
  order by created_at asc
  limit 1;

  if main_league_id is not null then
    insert into public.league_members (league_id, user_id)
    values (main_league_id, new.id)
    on conflict (league_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_profile_created_join_main_league on public.profiles;

create trigger on_profile_created_join_main_league
after insert on public.profiles
for each row
execute function public.add_user_to_main_league();

