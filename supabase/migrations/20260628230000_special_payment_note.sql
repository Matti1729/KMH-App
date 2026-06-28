-- Optionale "Sonderzahlungen" pro Spieler im Provisions-Modal. Häkchen aktiviert ein
-- Notizfeld zur Erklärung. Checkbox = Notizfeld nicht null (auch leerer String = aktiv).
alter table public.player_details
  add column if not exists special_payment_note text;
