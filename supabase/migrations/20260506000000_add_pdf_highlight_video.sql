-- Optionales Highlight-Video im PDF-Exposé: Verweis auf einen Eintrag in player_videos.
-- ON DELETE SET NULL: wenn das Video aus der Library gelöscht wird, wird der Verweis
-- automatisch geleert und das PDF rendert wieder ohne Card.
ALTER TABLE player_details
  ADD COLUMN IF NOT EXISTS pdf_highlight_video_id UUID
  REFERENCES player_videos(id) ON DELETE SET NULL;
