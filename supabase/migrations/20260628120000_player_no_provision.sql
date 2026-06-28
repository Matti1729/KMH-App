-- Markiert pro Spieler + Saison explizit "keine Provision".
-- Unterscheidet sich von "noch kein Eintrag": der Spieler hat in dieser Saison
-- bewusst keine Provision (statt nur noch nicht erfasst).
create table if not exists public.player_no_provision (
  player_id uuid not null references public.player_details(id) on delete cascade,
  season text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (player_id, season)
);

alter table public.player_no_provision enable row level security;

drop policy if exists no_provision_staff_select on public.player_no_provision;
create policy no_provision_staff_select on public.player_no_provision
  for select to authenticated using (public.is_kmh_staff());

drop policy if exists no_provision_staff_insert on public.player_no_provision;
create policy no_provision_staff_insert on public.player_no_provision
  for insert to authenticated with check (public.is_kmh_staff());

drop policy if exists no_provision_staff_delete on public.player_no_provision;
create policy no_provision_staff_delete on public.player_no_provision
  for delete to authenticated using (public.is_kmh_staff());
