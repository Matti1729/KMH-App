-- Liga des Stammvereins (von dem der Spieler ausgeliehen ist).
-- Wird im PDF-Exposé als zweite Zeile unter dem aktuellen Verein angezeigt.
ALTER TABLE player_details ADD COLUMN IF NOT EXISTS loan_from_club_league TEXT;
