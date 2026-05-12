-- Direkt-URL-Eingabe für das Highlight-Video im PDF.
-- Vorrang: pdf_highlight_video_url (manuell) > pdf_highlight_video_id (Library).
-- Gedacht für YouTube/Vimeo-Links die nicht zwingend in der Library liegen.
ALTER TABLE player_details
  ADD COLUMN IF NOT EXISTS pdf_highlight_video_url TEXT;
