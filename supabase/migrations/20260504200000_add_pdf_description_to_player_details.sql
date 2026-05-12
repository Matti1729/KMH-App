-- PDF-Beschreibungstext (Player-Description) im Spielerprofil-PDF
-- Wird im PDF-Editor unter "Spieler-Beschreibung" eingegeben und im PDF-Body gerendert
ALTER TABLE player_details
  ADD COLUMN IF NOT EXISTS pdf_description TEXT;
