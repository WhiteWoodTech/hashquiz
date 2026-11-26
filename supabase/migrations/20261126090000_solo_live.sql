-- Solo live mode: finished solo runs, their answers, the scoring-mode switch and Markuiz leads.
-- anon never writes solo_runs / solo_answers directly: browser mode goes through submit_solo_run
-- (security definer, gated by solo_settings.scoring_mode), edge mode through the solo-submit
-- Edge Function (service role). See docs/TECHNICAL_GUIDE.md.

create table public.solo_runs (
  id uuid primary key default gen_random_uuid(),
  deck_id text not null,
  deck_version text not null,
  room_id uuid null,
  pseudo text not null check (char_length(pseudo) between 1 and 24),
  score int not null,
  correct_count int not null,
  question_count int not null,
  total_time_ms int not null,
  finished_at timestamptz not null default now()
);

create index solo_runs_leaderboard_idx
  on public.solo_runs (deck_id, score desc, total_time_ms, finished_at);

create table public.solo_answers (
  run_id uuid not null references public.solo_runs on delete cascade,
  position int not null,
  deck_index int not null,
  choices int[] not null,
  is_correct bool not null,
  answer_time_ms int not null,
  points int not null,
  primary key (run_id, position)
);

create table public.solo_settings (
  id bool primary key default true check (id),
  scoring_mode text not null default 'browser' check (scoring_mode in ('browser', 'edge'))
);

insert into public.solo_settings default values;

create table public.leads (
  id bigserial primary key,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  consent bool not null check (consent),
  deck_id text,
  created_at timestamptz not null default now()
);

-- Row Level Security --------------------------------------------------------

alter table public.solo_runs enable row level security;
alter table public.solo_answers enable row level security;
alter table public.solo_settings enable row level security;
alter table public.leads enable row level security;

create policy "solo_runs are public" on public.solo_runs
  for select to anon, authenticated using (true);

create policy "solo_answers are public" on public.solo_answers
  for select to anon, authenticated using (true);

create policy "solo_settings are public" on public.solo_settings
  for select to anon, authenticated using (true);

create policy "anyone can leave a lead" on public.leads
  for insert to anon, authenticated with check (true);

-- Table privileges: Supabase grants everything to anon/authenticated by default; narrow it so the
-- grants match the policies above (defence in depth).
revoke all on public.solo_runs, public.solo_answers, public.solo_settings, public.leads
  from anon, authenticated;
grant select on public.solo_runs, public.solo_answers, public.solo_settings to anon, authenticated;
grant insert on public.leads to anon, authenticated;
grant usage on sequence public.leads_id_seq to anon, authenticated;

-- RPCs -----------------------------------------------------------------------

-- Inserts a verified run (VerifiedRun in snake_case) and its answers atomically. Not exposed to
-- clients: only service_role (solo-submit) and submit_solo_run (as owner) call it.
create function public.insert_solo_run(p_run jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
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

-- Browser scoring mode: the client computed the run itself. Refused once the deployment is in edge mode.
create function public.submit_solo_run(p_run jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select scoring_mode from solo_settings where id) <> 'browser' then
    raise exception 'solo runs are scored by the edge function (scoring_mode is not browser)'
      using errcode = '42501';
  end if;
  return insert_solo_run(p_run);
end;
$$;

-- Rank of a run within its deck leaderboard: score desc, total_time_ms asc, finished_at asc
-- (same order as compareRuns in @quizv/core).
create function public.solo_rank(p_run_id uuid)
returns int
language sql
stable
set search_path = public
as $$
  select 1 + (
    select count(*)::int
    from solo_runs o
    where o.deck_id = r.deck_id
      and (
        o.score > r.score
        or (o.score = r.score and o.total_time_ms < r.total_time_ms)
        or (o.score = r.score and o.total_time_ms = r.total_time_ms and o.finished_at < r.finished_at)
      )
  )
  from solo_runs r
  where r.id = p_run_id;
$$;

-- Supabase grants execute on new public functions to anon/authenticated by default.
revoke execute on function public.insert_solo_run(jsonb) from public, anon, authenticated;
grant execute on function public.insert_solo_run(jsonb) to service_role;
grant execute on function public.submit_solo_run(jsonb) to anon, authenticated;
grant execute on function public.solo_rank(uuid) to anon, authenticated, service_role;

-- New finished runs are pushed to leaderboards via Realtime.
alter publication supabase_realtime add table public.solo_runs;
