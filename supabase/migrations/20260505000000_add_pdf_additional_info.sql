-- Optionale Bullet-Punkte im PDF-Block "Weitere Informationen"
-- Format: einzelne Punkte durch ';' getrennt (analog zu strengths/potentials)
ALTER TABLE player_details
  ADD COLUMN IF NOT EXISTS pdf_additional_info TEXT;
