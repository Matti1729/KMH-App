-- "Provision-only"-Einträge: Spieler, die ein Berater NICHT betreut, für die er aber
-- Provision erhält. Sie erscheinen nur in den Finanzen (Provisionen), nicht in der
-- normalen KMH-Spielerübersicht.
alter table public.player_details
  add column if not exists provision_only boolean not null default false;
