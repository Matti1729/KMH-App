-- Freitext-Saison-Label für Karrierestationen.
-- Erlaubt dem Berater, die Saison-Spalte im PDF-Karriereverlauf mit beliebigem
-- Text zu überschreiben (z.B. "U17 Saison 24/25", "Vorbereitung", "2024").
-- Wenn NULL: PDF leitet die Saison wie bisher aus from_date/to_date ab.
ALTER TABLE player_career ADD COLUMN IF NOT EXISTS season_label TEXT;
