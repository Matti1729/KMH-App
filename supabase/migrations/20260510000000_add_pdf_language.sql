-- PDF-Sprache pro Spieler ('de' oder 'en'). Default Deutsch.
ALTER TABLE player_details
  ADD COLUMN IF NOT EXISTS pdf_language TEXT DEFAULT 'de';
