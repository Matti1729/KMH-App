-- Neues Spieler-Feld in "Sonstiges": "Was erwartest du von uns? / Wie sieht
-- Beratung für dich aus?" — vom Spieler selbst gepflegt.
alter table public.player_details add column if not exists consulting_expectations_player text;
