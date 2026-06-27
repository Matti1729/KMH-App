-- Einmalige Willkommensnachricht für neu registrierte Spieler.
-- Flag merkt sich, ob der Spieler die Begrüßung schon gesehen hat.
alter table public.player_details add column if not exists welcome_seen boolean not null default false;

-- Bereits registrierte Spieler sollen die Begrüßung NICHT nachträglich sehen.
update public.player_details set welcome_seen = true where linked_user_id is not null;
