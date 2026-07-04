create table if not exists public.habit_sync_states (
  sync_key text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.habit_sync_states enable row level security;

drop policy if exists "habit sync read" on public.habit_sync_states;
drop policy if exists "habit sync insert" on public.habit_sync_states;
drop policy if exists "habit sync update" on public.habit_sync_states;

create policy "habit sync read"
  on public.habit_sync_states
  for select
  to anon
  using (true);

create policy "habit sync insert"
  on public.habit_sync_states
  for insert
  to anon
  with check (true);

create policy "habit sync update"
  on public.habit_sync_states
  for update
  to anon
  using (true)
  with check (true);
