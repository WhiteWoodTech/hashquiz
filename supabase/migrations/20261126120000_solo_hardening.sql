-- Solo live hardening (final review of 20261126090000_solo_live.sql):
-- 1. submit_solo_run fails closed when solo_settings has no row or a null mode.
-- 2. insert_solo_run (both scoring paths) requires 1–200 answers, matching question_count.
-- 3. leads: length caps on email and deck_id.
-- `create or replace` keeps the existing execute grants.

create or replace function public.insert_solo_run(p_run jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_count int;
begin
  if jsonb_typeof(p_run->'answers') is distinct from 'array' then
    raise exception 'solo run answers must be an array' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_run->'answers');
  if v_count not between 1 and 200 then
    raise exception 'solo run must have between 1 and 200 answers' using errcode = '22023';
  end if;
  if v_count is distinct from (p_run->>'question_count')::int then
    raise exception 'solo run answer count does not match question_count' using errcode = '22023';
  end if;

  insert into solo_runs (deck_id, deck_version, pseudo, score, correct_count, question_count, total_time_ms)
  values (
    p_run->>'deck_id',
    p_run->>'deck_version',
    p_run->>'pseudo',
    (p_run->>'score')::int,
    (p_run->>'correct_count')::int,
    (p_run->>'question_count')::int,
    (p_run->>'total_time_ms')::int
  )
  returning id into v_id;

  insert into solo_answers (run_id, position, deck_index, choices, is_correct, answer_time_ms, points)
  select
    v_id,
    (a->>'position')::int,
    (a->>'deck_index')::int,
    array(select jsonb_array_elements_text(a->'choices')::int),
    (a->>'is_correct')::bool,
    (a->>'answer_time_ms')::int,
    (a->>'points')::int
  from jsonb_array_elements(p_run->'answers') as a;

  return v_id;
end;
$$;

-- Fails closed: a missing settings row or a null mode refuses browser-scored runs too.
create or replace function public.submit_solo_run(p_run jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select scoring_mode from solo_settings where id) is distinct from 'browser' then
    raise exception 'solo runs are scored by the edge function (scoring_mode is not browser)'
      using errcode = '42501';
  end if;
  return insert_solo_run(p_run);
end;
$$;

alter table public.leads
  add constraint leads_email_length check (char_length(email) <= 254),
  add constraint leads_deck_id_length check (char_length(deck_id) <= 200);
