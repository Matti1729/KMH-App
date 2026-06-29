-- "Provision ohne Betreuung"-Spieler (provision_only) werden nur für ausgewählte
-- Saisons angelegt. provision_seasons hält die Saisons (z.B. {'2026/27','2027/28'}).
-- Null/leer = in allen Saisons sichtbar (Abwärtskompatibilität für Altbestand).
alter table public.player_details
  add column if not exists provision_seasons text[];
