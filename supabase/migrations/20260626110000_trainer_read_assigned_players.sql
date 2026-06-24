-- Athletiktrainer darf die ihm zugewiesenen Spieler in player_details LESEN.
-- Additive Policy (RLS-Policies werden ODER-verknüpft) — bestehende Berater-/Spieler-
-- Zugriffe bleiben unverändert; der Trainer sieht ausschließlich zugewiesene Spieler.

drop policy if exists player_details_trainer_select on public.player_details;
create policy player_details_trainer_select on public.player_details
  for select to authenticated
  using (
    exists (
      select 1 from public.player_trainer_assignments pta
      where pta.player_id = player_details.id
        and pta.trainer_id = auth.uid()
    )
  );
