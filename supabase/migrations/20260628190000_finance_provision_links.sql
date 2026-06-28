-- Verknüpft einen Berater mit KMH-Spielern, die er NICHT betreut, für die er aber
-- Provision erhält. Diese Spieler erscheinen zusätzlich in seiner Provisionen-Liste,
-- ohne dass sich die Zuständigkeit (responsibility) des Spielers ändert.
create table if not exists public.finance_provision_links (
  advisor_id uuid not null,
  player_id uuid not null references public.player_details(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (advisor_id, player_id)
);

alter table public.finance_provision_links enable row level security;

-- Jeder Berater verwaltet nur seine eigenen Verknüpfungen.
drop policy if exists fpl_select_own on public.finance_provision_links;
create policy fpl_select_own on public.finance_provision_links
  for select to authenticated using (advisor_id = auth.uid());

drop policy if exists fpl_insert_own on public.finance_provision_links;
create policy fpl_insert_own on public.finance_provision_links
  for insert to authenticated with check (advisor_id = auth.uid());

drop policy if exists fpl_delete_own on public.finance_provision_links;
create policy fpl_delete_own on public.finance_provision_links
  for delete to authenticated using (advisor_id = auth.uid());
