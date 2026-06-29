-- Mehrere unabhängige Finanz-Einträge pro Spieler+Saison (Provision, Wegvermittlung,
-- Sonderzahlung) nebeneinander. Die Ratenzeilen eines Eintrags teilen sich eine
-- entry_id; percent/note halten die eintragsspezifischen Zusatzangaben.
alter table public.player_provisions
  add column if not exists entry_id uuid,
  add column if not exists percent text,
  add column if not exists note text;
