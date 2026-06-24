-- Zuordnung Spieler -> Athletiktrainer. Berater „übergeben" Spieler an einen Trainer;
-- der Trainer sieht in seiner Liste nur die ihm zugewiesenen Spieler.

create table if not exists public.player_trainer_assignments (
  player_id  uuid not null references public.player_details(id) on delete cascade,
  trainer_id uuid not null references public.advisors(id) on delete cascade,
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  primary key (player_id, trainer_id)
);

create index if not exists idx_pta_trainer on public.player_trainer_assignments(trainer_id);

-- Helfer: ist der aktuelle User Berater/Admin? (SECURITY DEFINER, um RLS-Rekursion zu meiden)
create or replace function public.is_kmh_staff()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.advisors
    where id = auth.uid() and role in ('advisor', 'admin', 'berater')
  );
$$;
revoke all on function public.is_kmh_staff() from public;
grant execute on function public.is_kmh_staff() to authenticated;

alter table public.player_trainer_assignments enable row level security;

-- Lesen: Trainer sieht eigene Zuweisungen; Berater/Admin sehen alle.
drop policy if exists pta_select on public.player_trainer_assignments;
create policy pta_select on public.player_trainer_assignments
  for select to authenticated
  using (trainer_id = auth.uid() or public.is_kmh_staff());

-- Einfügen/Löschen: nur Berater/Admin.
drop policy if exists pta_insert on public.player_trainer_assignments;
create policy pta_insert on public.player_trainer_assignments
  for insert to authenticated
  with check (public.is_kmh_staff());

drop policy if exists pta_delete on public.player_trainer_assignments;
create policy pta_delete on public.player_trainer_assignments
  for delete to authenticated
  using (public.is_kmh_staff());
