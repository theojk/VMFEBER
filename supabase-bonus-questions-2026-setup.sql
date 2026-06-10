-- Kjor denne etter supabase-player-options-setup.sql.
-- Gruppeplasseringer avledes fortsatt fra kamptips og seedes ikke som inputfelt.

alter table public.bonus_questions
  add column if not exists slug text unique,
  add column if not exists question_type text not null default 'text',
  add column if not exists option_source text,
  add column if not exists validation_rule jsonb not null default '{}'::jsonb,
  add column if not exists description text,
  add column if not exists is_active boolean not null default true;

insert into public.bonus_questions (
  competition_id, slug, label, points, sort_order, question_type,
  option_source, validation_rule, description, is_active
)
select
  competition.id,
  question.slug,
  question.label,
  question.points,
  question.sort_order,
  question.question_type,
  question.option_source,
  question.validation_rule,
  question.description,
  true
from public.competitions competition
cross join (values
  ('vm_vinner', 'Hvem vinner VM?', 3, 1, 'team', 'teams', '{}'::jsonb, '3 poeng for riktig verdensmester.'),
  ('tapende_finalist', 'Hvem taper finalen?', 2, 2, 'team', 'teams', '{}'::jsonb, '2 poeng for riktig tapende finalist.'),
  ('toppscorer', 'Hvilken spiller scorer flest mål?', 2, 4, 'player', 'players', '{}'::jsonb, '2 poeng for riktig spiller.'),
  ('toppscorer_antall_maal', 'Hvor mange mål scorer toppscoreren?', 2, 5, 'number', null, '{"min": 0, "max": 30}'::jsonb, '2 tilleggspoeng dersom toppscoreren og antallet er riktig.'),
  ('flest_kort_spiller', 'Hvilken spiller får flest gule/røde kort?', 2, 6, 'player', 'players', '{}'::jsonb, 'Ett rødt kort teller som to gule.'),
  ('flest_kort_antall', 'Hvor mange kort får spilleren med flest kort?', 2, 7, 'number', null, '{"min": 0, "max": 30}'::jsonb, '2 tilleggspoeng dersom spilleren og antallet er riktig.'),
  ('darligste_gruppelag', 'Hvilken nasjon får færrest poeng i gruppespillet?', 1, 8, 'team', 'teams', '{}'::jsonb, 'Ved lik poengsum gjelder dårligst målforskjell.'),
  ('totalt_antall_maal', 'Hvor mange mål scores totalt i VM?', 3, 9, 'number', null, '{"min": 0, "max": 500}'::jsonb, '3 poeng dersom svaret er innenfor pluss/minus 5 mål.'),
  ('odegaard_star_over', 'Må Martin Ødegaard byttes ut eller stå over minst én kamp?', 1, 10, 'boolean', null, '{}'::jsonb, '1 poeng for riktig ja/nei-svar.'),
  ('england_ut_pa_straffer', 'Ryker England ut av VM på straffesparkkonkurranse?', 1, 11, 'boolean', null, '{}'::jsonb, '1 poeng for riktig ja/nei-svar.')
) as question(slug, label, points, sort_order, question_type, option_source, validation_rule, description)
where competition.slug = 'full-vm'
on conflict (slug) do update set
  label = excluded.label,
  points = excluded.points,
  sort_order = excluded.sort_order,
  question_type = excluded.question_type,
  option_source = excluded.option_source,
  validation_rule = excluded.validation_rule,
  description = excluded.description,
  is_active = true;

create or replace function public.save_bonus_prediction(question_slug text, answer_value text)
returns public.bonus_predictions
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_question public.bonus_questions;
  deadline timestamptz;
  saved_prediction public.bonus_predictions;
  number_answer integer;
begin
  if auth.uid() is null then raise exception 'Du ma vaere innlogget.'; end if;

  select min(kickoff_at) - interval '2 hours' into deadline from public.matches;
  if deadline is null or now() >= deadline then raise exception 'Full VM-fristen har utlopet.'; end if;

  select question.* into selected_question
  from public.bonus_questions question
  join public.competitions competition on competition.id = question.competition_id
  where question.slug = question_slug
    and question.is_active = true
    and competition.slug = 'full-vm';

  if selected_question.id is null then raise exception 'Fant ikke bonussporsmalet.'; end if;
  if nullif(trim(answer_value), '') is null then raise exception 'Velg eller skriv inn et svar.'; end if;

  if selected_question.question_type = 'player'
    and not exists (
      select 1 from public.players player
      where player.id::text = answer_value and player.is_active
    )
  then raise exception 'Spilleren er ikke et gyldig valg.'; end if;

  if selected_question.question_type = 'team'
    and not exists (
      select 1 from public.teams team
      where team.fifa_code = answer_value and team.is_active
    )
  then raise exception 'Laget er ikke et gyldig valg.'; end if;

  if selected_question.question_type = 'number' then
    begin
      number_answer := answer_value::integer;
    exception when invalid_text_representation then
      raise exception 'Svaret ma vaere et heltall.';
    end;
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
  on conflict (user_id, question_id) do update
  set answer = excluded.answer, updated_at = now()
  returning * into saved_prediction;

  return saved_prediction;
end;
$$;

create or replace function public.get_my_bonus_predictions_resolved()
returns table (
  question_slug text,
  answer text,
  answer_label text,
  points integer,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    question.slug,
    prediction.answer,
    case
      when question.question_type = 'player' then coalesce(
        (select player.player_name || ' (' || player.team_name || ')'
         from public.players player where player.id::text = prediction.answer limit 1),
        prediction.answer
      )
      when question.question_type = 'team' then coalesce(
        (select team.display_name from public.teams team where team.fifa_code = prediction.answer limit 1),
        prediction.answer
      )
      when question.question_type = 'boolean' then case prediction.answer when 'true' then 'Ja' else 'Nei' end
      else prediction.answer
    end,
    prediction.points,
    prediction.updated_at
  from public.bonus_predictions prediction
  join public.bonus_questions question on question.id = prediction.question_id
  where prediction.user_id = auth.uid();
$$;

revoke all on function public.save_bonus_prediction(text, text) from public, anon;
revoke all on function public.get_my_bonus_predictions_resolved() from public, anon;
grant execute on function public.save_bonus_prediction(text, text) to authenticated;
grant execute on function public.get_my_bonus_predictions_resolved() to authenticated;
