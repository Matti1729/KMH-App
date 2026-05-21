-- Ausgeliehene Spieler: Verein, von dem der Spieler aktuell ausgeliehen ist.
-- Wird im Detail-Header in Klammern hinter dem aktuellen Verein angezeigt
-- und im Vertrag-Block als eigenes Feld unter "Verein".
ALTER TABLE player_details ADD COLUMN IF NOT EXISTS loan_from_club TEXT;
