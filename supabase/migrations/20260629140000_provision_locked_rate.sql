-- USD-Beträge werden für die Summen in EUR umgerechnet. Sobald eine USD-Zahlung als
-- "bezahlt" markiert wird, wird der an dem Tag gültige USD->EUR-Kurs fest hinterlegt
-- (locked_rate), damit spätere Kursschwankungen den bezahlten Betrag nicht mehr ändern.
alter table public.player_provisions
  add column if not exists locked_rate numeric;
